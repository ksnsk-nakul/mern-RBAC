import bcrypt from 'bcryptjs'
import { connectDB } from '../config/db.js'
import { env } from '../config/env.js'
import { Role } from '../models/Role.js'
import { Permission } from '../models/Permission.js'
import { User } from '../models/User.js'
import { UserRole } from '../models/UserRole.js'
import { Setting } from '../models/Setting.js'
import { Secret } from '../models/Secret.js'
import { CORE_PERMISSIONS, CORE_SETTINGS, CORE_SECRETS } from './data.js'

async function seed() {
  await connectDB()
  console.log('Seeding...')

  // 1. Permissions
  for (const p of CORE_PERMISSIONS) {
    await Permission.findOneAndUpdate(
      { slug: p.slug },
      { $setOnInsert: { ...p, isProtected: true } },
      { upsert: true, new: true },
    )
  }
  console.log('✓ Permissions seeded')

  // 2. Roles
  const superAdmin = await Role.findOneAndUpdate(
    { slug: 'super_admin' },
    { $setOnInsert: { name: 'Super Admin', slug: 'super_admin', route: 'admin', color: '#6366f1', isProtected: true, isSubAdmin: false, isDefault: false, mfaRequired: false, requireIpAllowlist: false } },
    { upsert: true, new: true },
  )

  const userRole = await Role.findOneAndUpdate(
    { slug: 'user' },
    { $setOnInsert: { name: 'User', slug: 'user', route: 'dashboard', color: '#10b981', isProtected: false, isSubAdmin: false, isDefault: true, mfaRequired: false, requireIpAllowlist: false } },
    { upsert: true, new: true },
  )

  const subAdmin = await Role.findOneAndUpdate(
    { slug: 'subadmin' },
    { $setOnInsert: { name: 'Sub Admin', slug: 'subadmin', route: 'subadmin', color: '#f59e0b', isProtected: false, isSubAdmin: true, isDefault: false, mfaRequired: false, requireIpAllowlist: false } },
    { upsert: true, new: true },
  )

  console.log('✓ Roles seeded', { superAdmin: superAdmin!._id, userRole: userRole!._id, subAdmin: subAdmin!._id })

  // 3. Admin user
  const existingAdmin = await User.findOne({ email: env.SEED_ADMIN_EMAIL })
  let adminUser = existingAdmin

  if (!adminUser) {
    const hashed = await bcrypt.hash(env.SEED_ADMIN_PASSWORD, 12)
    adminUser = await User.create({
      name: 'Super Admin',
      email: env.SEED_ADMIN_EMAIL,
      password: hashed,
      isFounder: true,
    })
    console.log('✓ Admin user created:', env.SEED_ADMIN_EMAIL)
  } else {
    console.log('✓ Admin user already exists:', env.SEED_ADMIN_EMAIL)
  }

  // 4. Assign super_admin role to admin user
  await UserRole.findOneAndUpdate(
    { userId: adminUser._id, roleId: superAdmin!._id },
    { $setOnInsert: { userId: adminUser._id, roleId: superAdmin!._id, isPrimary: true, isActive: true, assignedAt: new Date() } },
    { upsert: true },
  )
  console.log('✓ Admin role assigned')

  // 5. Settings
  for (const s of CORE_SETTINGS) {
    await Setting.findOneAndUpdate(
      { slug: s.slug },
      { $setOnInsert: s },
      { upsert: true },
    )
  }
  console.log('✓ Settings seeded')

  // 6. Secrets (stubs)
  for (const s of CORE_SECRETS) {
    await Secret.findOneAndUpdate(
      { slug: s.slug },
      { $setOnInsert: { ...s, isSet: false } },
      { upsert: true },
    )
  }
  console.log('✓ Secrets seeded')

  console.log('Seed complete.')
  process.exit(0)
}

seed().catch((err) => {
  console.error('Seed failed:', err)
  process.exit(1)
})
