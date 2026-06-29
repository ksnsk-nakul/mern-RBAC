import os
import uuid
from datetime import datetime, timezone
from typing import AsyncIterator

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.responses import StreamingResponse
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field
import anthropic

load_dotenv()

MONGO_URI  = os.getenv("MONGO_URI",  "mongodb://localhost:27017/rbac")
MODEL_ID   = os.getenv("AI_MODEL",   "claude-haiku-4-5-20251001")
MAX_TOKENS = int(os.getenv("AI_MAX_TOKENS", "1024"))

app = FastAPI(title="RBAC AI Service")

_client: AsyncIOMotorClient | None = None

def db():
    global _client
    if _client is None:
        _client = AsyncIOMotorClient(MONGO_URI)
    return _client["rbac"]


# ── Models ────────────────────────────────────────────────────────────────────

class ConversationOut(BaseModel):
    id:         str
    userId:     str
    title:      str
    createdAt:  str
    updatedAt:  str

class MessageOut(BaseModel):
    id:        str
    role:      str
    content:   str
    createdAt: str

class ConversationDetail(BaseModel):
    id:        str
    userId:    str
    title:     str
    messages:  list[MessageOut]
    createdAt: str
    updatedAt: str

class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=10000)

class CreateConversationRequest(BaseModel):
    userId: str
    title:  str = "New conversation"


# ── Helpers ──────────────────────────────────────────────────────────────────

def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()

def doc_to_conversation(doc: dict) -> ConversationOut:
    return ConversationOut(
        id        = str(doc["_id"]),
        userId    = doc["userId"],
        title     = doc["title"],
        createdAt = doc["createdAt"],
        updatedAt = doc["updatedAt"],
    )

def doc_to_message(doc: dict) -> MessageOut:
    return MessageOut(
        id        = str(doc["_id"]),
        role      = doc["role"],
        content   = doc["content"],
        createdAt = doc["createdAt"],
    )


# ── Routes ───────────────────────────────────────────────────────────────────

@app.get("/health")
def health():
    return {"status": "ok", "model": MODEL_ID}


@app.get("/conversations/{user_id}", response_model=list[ConversationOut])
async def list_conversations(user_id: str):
    cursor = db()["chat_conversations"].find(
        {"userId": user_id},
        sort=[("updatedAt", -1)],
    )
    return [doc_to_conversation(d) async for d in cursor]


@app.post("/conversations", response_model=ConversationOut, status_code=201)
async def create_conversation(body: CreateConversationRequest):
    now  = now_iso()
    doc  = {
        "_id":       str(uuid.uuid4()),
        "userId":    body.userId,
        "title":     body.title,
        "createdAt": now,
        "updatedAt": now,
    }
    await db()["chat_conversations"].insert_one(doc)
    return doc_to_conversation(doc)


@app.get("/conversations/{conversation_id}/detail", response_model=ConversationDetail)
async def get_conversation(conversation_id: str):
    conv = await db()["chat_conversations"].find_one({"_id": conversation_id})
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
    msgs_cursor = db()["chat_messages"].find(
        {"conversationId": conversation_id},
        sort=[("createdAt", 1)],
    )
    msgs = [doc_to_message(m) async for m in msgs_cursor]
    return ConversationDetail(
        id        = str(conv["_id"]),
        userId    = conv["userId"],
        title     = conv["title"],
        messages  = msgs,
        createdAt = conv["createdAt"],
        updatedAt = conv["updatedAt"],
    )


@app.delete("/conversations/{conversation_id}", status_code=204)
async def delete_conversation(conversation_id: str):
    result = await db()["chat_conversations"].delete_one({"_id": conversation_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Conversation not found")
    await db()["chat_messages"].delete_many({"conversationId": conversation_id})


@app.post("/conversations/{conversation_id}/chat")
async def chat(conversation_id: str, body: ChatRequest):
    conv = await db()["chat_conversations"].find_one({"_id": conversation_id})
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")

    # Save user message
    now = now_iso()
    user_msg = {
        "_id":            str(uuid.uuid4()),
        "conversationId": conversation_id,
        "role":           "user",
        "content":        body.message,
        "createdAt":      now,
    }
    await db()["chat_messages"].insert_one(user_msg)

    # Build message history for Anthropic
    history_cursor = db()["chat_messages"].find(
        {"conversationId": conversation_id},
        sort=[("createdAt", 1)],
    )
    history = [
        {"role": m["role"], "content": m["content"]}
        async for m in history_cursor
    ]

    # Update conversation title from first user message if still default
    if conv["title"] == "New conversation":
        short_title = body.message[:60]
        await db()["chat_conversations"].update_one(
            {"_id": conversation_id},
            {"$set": {"title": short_title, "updatedAt": now}},
        )
    else:
        await db()["chat_conversations"].update_one(
            {"_id": conversation_id},
            {"$set": {"updatedAt": now}},
        )

    async def stream_response() -> AsyncIterator[bytes]:
        ai_client = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY", ""))
        full_text = ""

        with ai_client.messages.stream(
            model      = MODEL_ID,
            max_tokens = MAX_TOKENS,
            messages   = history,
        ) as stream:
            for text in stream.text_stream:
                full_text += text
                yield text.encode()

        # Save assistant message after stream completes
        asst_msg = {
            "_id":            str(uuid.uuid4()),
            "conversationId": conversation_id,
            "role":           "assistant",
            "content":        full_text,
            "createdAt":      now_iso(),
        }
        await db()["chat_messages"].insert_one(asst_msg)

    return StreamingResponse(stream_response(), media_type="text/plain")
