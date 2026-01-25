import { PrismaClient, CategoryType } from '@prisma/client';
import { DEFAULT_CATEGORIES } from '@otter-money/shared';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Create default system categories
  // These have householdId = null and are available to all households
  const categoryTypes: CategoryType[] = ['INCOME', 'EXPENSE', 'TRANSFER'];

  for (const type of categoryTypes) {
    const categories = DEFAULT_CATEGORIES[type];
    for (const cat of categories) {
      // Check if category already exists
      const existing = await prisma.category.findFirst({
        where: {
          name: cat.name,
          type: type,
          isSystem: true,
          householdId: null,
        },
      });

      if (!existing) {
        await prisma.category.create({
          data: {
            name: cat.name,
            type,
            icon: cat.icon,
            isSystem: true,
            householdId: null,
          },
        });
        console.log(`  Created category: ${cat.name}`);
      } else {
        console.log(`  Category exists: ${cat.name}`);
      }
    }
  }

  console.log('✅ Seed complete!');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
