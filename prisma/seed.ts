const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Create default admin user
  const passwordHash = await bcrypt.hash('admin123', 10);
  const admin = await prisma.user.upsert({
    where: { username: 'admin' },
    update: {},
    create: {
      username: 'admin',
      passwordHash,
      name: 'Administrator',
      role: 'admin',
    },
  });
  console.log(`✅ Admin user created: ${admin.username} (password: admin123)`);

  // Create default settings
  const defaultSettings = [
    { key: 'tea_price_per_kilo', value: '100' },
    { key: 'commission_rate', value: '5' },
    { key: 'other_deduction_rate', value: '5' },
  ];

  for (const setting of defaultSettings) {
    await prisma.settings.upsert({
      where: { key: setting.key },
      update: {},
      create: setting,
    });
  }
  console.log('✅ Default settings created');

  // Create some sample fertilisers
  const fertilisers = [
    { name: 'T-65 Fertiliser', pricePerUnit: 5500, weightPerBag: 50 },
    { name: 'U-709 Fertiliser', pricePerUnit: 4800, weightPerBag: 50 },
    { name: 'Dolomite', pricePerUnit: 1200, weightPerBag: 50 },
    { name: 'Tea Special Mixture', pricePerUnit: 6200, weightPerBag: 25 },
  ];

  for (const fert of fertilisers) {
    await prisma.fertiliser.upsert({
      where: { id: fertilisers.indexOf(fert) + 1 },
      update: {},
      create: fert,
    });
  }
  console.log('✅ Sample fertilisers created');

  console.log('🎉 Seeding complete!');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
