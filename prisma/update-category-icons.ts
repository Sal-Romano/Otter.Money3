import { PrismaClient } from '@prisma/client';
import { DEFAULT_CATEGORIES } from '@otter-money/shared';

const prisma = new PrismaClient();

async function main() {
  console.log('🔄 Updating category icons to emoji...');

  const allCategories = [
    ...DEFAULT_CATEGORIES.INCOME,
    ...DEFAULT_CATEGORIES.EXPENSE,
    ...DEFAULT_CATEGORIES.TRANSFER,
  ];

  for (const cat of allCategories) {
    const updated = await prisma.category.updateMany({
      where: {
        name: cat.name,
        isSystem: true,
        householdId: null,
      },
      data: {
        icon: cat.icon,
      },
    });

    if (updated.count > 0) {
      console.log(`  ✓ Updated ${cat.name}: ${cat.icon}`);
    }
  }

  console.log('✅ Category icons updated!');
}

main()
  .catch((e) => {
    console.error('❌ Update failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
