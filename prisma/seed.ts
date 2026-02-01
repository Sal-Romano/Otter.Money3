import { PrismaClient, CategoryType } from '@prisma/client';
import { DEFAULT_CATEGORIES, DEFAULT_CATEGORIES_HIERARCHICAL, HierarchicalCategory } from '@otter-money/shared';

const prisma = new PrismaClient();

// Seed hierarchical categories recursively
async function seedCategoryTree(
  categories: HierarchicalCategory[],
  type: CategoryType,
  parentId: string | null,
  depth: number,
  startingOrder: number = 0
): Promise<number> {
  let displayOrder = startingOrder;

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

    let categoryId: string;

    if (!existing) {
      const created = await prisma.category.create({
        data: {
          name: cat.name,
          type,
          icon: cat.icon,
          color: cat.color || null,
          parentId,
          depth,
          displayOrder,
          isSystem: true,
          householdId: null,
        },
      });
      categoryId = created.id;
      console.log(`  ${'  '.repeat(depth)}Created: ${cat.name}`);
    } else {
      // Update existing category with new fields
      await prisma.category.update({
        where: { id: existing.id },
        data: {
          icon: cat.icon,
          color: cat.color || null,
          parentId,
          depth,
          displayOrder,
        },
      });
      categoryId = existing.id;
      console.log(`  ${'  '.repeat(depth)}Updated: ${cat.name}`);
    }

    displayOrder++;

    // Seed children recursively
    if (cat.children && cat.children.length > 0) {
      await seedCategoryTree(cat.children, type, categoryId, depth + 1, 0);
    }
  }

  return displayOrder;
}

async function main() {
  console.log('🌱 Seeding database...');

  // Check if we should use hierarchical categories (new system)
  // If hierarchical categories exist, use them; otherwise fall back to legacy
  const hasHierarchical = Object.keys(DEFAULT_CATEGORIES_HIERARCHICAL).length > 0;

  if (hasHierarchical) {
    console.log('\n📂 Seeding hierarchical categories...');

    // Seed hierarchical categories
    for (const type of ['EXPENSE', 'INCOME', 'TRANSFER'] as CategoryType[]) {
      const categories = DEFAULT_CATEGORIES_HIERARCHICAL[type];
      if (categories && categories.length > 0) {
        console.log(`\n  ${type}:`);
        await seedCategoryTree(categories, type, null, 0);
      }
    }
  } else {
    console.log('\n📁 Seeding flat categories (legacy)...');

    // Legacy flat category seeding
    const categoryTypes: CategoryType[] = ['INCOME', 'EXPENSE', 'TRANSFER'];

    for (const type of categoryTypes) {
      const categories = DEFAULT_CATEGORIES[type];
      let displayOrder = 0;

      for (const cat of categories) {
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
              depth: 0,
              displayOrder,
              isSystem: true,
              householdId: null,
            },
          });
          console.log(`  Created category: ${cat.name}`);
        } else {
          console.log(`  Category exists: ${cat.name}`);
        }

        displayOrder++;
      }
    }
  }

  console.log('\n✅ Seed complete!');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
