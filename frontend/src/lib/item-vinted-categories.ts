/** Vinted-style inventory categories for saved items (mirrors backend/src/lib/vinted-categories.js). */

export type VintedCategoryEntry = {
  id: string;
  label: string;
  group: string;
  section: string;
  path: string;
};

/** Stored category id on an item. */
export type ItemVintedCategory = string;

const TREE = [
  {
    group: "Women's Fashion",
    sections: [
      {
        name: 'Clothing',
        items: [
          'Dresses',
          'Tops',
          'T-shirts',
          'Coats',
          'Jackets',
          'Sweaters',
          'Cardigans',
          'Skirts',
          'Pants',
          'Leggings',
          'Jeans',
          'Shorts',
          'Jumpsuits',
          'Playsuits',
          'Activewear',
          'Swimwear',
          'Sleepwear',
          'Underwear',
          'Socks',
        ],
      },
      {
        name: 'Shoes',
        items: ['Boots', 'Heels', 'Flats', 'Sneakers', 'Sandals', 'Slippers', 'Sports shoes'],
      },
      {
        name: 'Bags',
        items: ['Handbags', 'Backpacks', 'Tote bags', 'Cross-body bags', 'Clutches', 'Travel bags'],
      },
      {
        name: 'Accessories',
        items: [
          'Sunglasses',
          'Belts',
          'Hats',
          'Caps',
          'Scarves',
          'Shawls',
          'Gloves',
          'Hair accessories',
          'Watches',
        ],
      },
      {
        name: 'Jewelry',
        items: ['Rings', 'Necklaces', 'Bracelets', 'Earrings', 'Brooches', 'Jewelry storage'],
      },
      {
        name: 'Beauty & Care',
        items: ['Makeup', 'Skincare', 'Haircare', 'Fragrances', 'Nail care'],
      },
    ],
  },
  {
    group: "Men's Fashion",
    sections: [
      {
        name: 'Clothing',
        items: [
          'Tops',
          'T-shirts',
          'Coats',
          'Jackets',
          'Sweaters',
          'Hoodies',
          'Suits',
          'Blazers',
          'Pants',
          'Jeans',
          'Shorts',
          'Activewear',
          'Swimwear',
          'Underwear',
          'Socks',
        ],
      },
      {
        name: 'Shoes',
        items: ['Sneakers', 'Boots', 'Dress shoes', 'Loafers', 'Sandals', 'Sports shoes'],
      },
      {
        name: 'Bags',
        items: ['Backpacks', 'Messenger bags', 'Briefcases', 'Travel bags'],
      },
      {
        name: 'Accessories',
        items: [
          'Belts',
          'Hats',
          'Caps',
          'Ties',
          'Pocket squares',
          'Scarves',
          'Gloves',
          'Sunglasses',
          'Wallets',
          'Watches',
        ],
      },
    ],
  },
  {
    group: 'Kids & Children',
    sections: [
      {
        name: 'Clothing',
        items: ['Baby clothing (0-24 months)', "Girls' clothing", "Boys' clothing"],
      },
      {
        name: 'Shoes',
        items: ['Baby shoes', "Girls' shoes", "Boys' shoes"],
      },
      {
        name: 'Toys & Games',
        items: [
          'Dolls',
          'Action figures',
          'Board games',
          'Puzzles',
          'Building blocks',
          'Outdoor toys',
          'Plush toys',
          'Educational toys',
        ],
      },
      {
        name: 'Childcare Equipment',
        items: [
          'Strollers',
          'Car seats',
          'Baby carriers',
          'High chairs',
          'Baby monitors',
          'Feeding supplies',
          'Bathing accessories',
        ],
      },
      {
        name: 'Nursery Furniture',
        items: [
          'Cribs',
          'Cots',
          'Changing tables',
          'Playpens',
          "Kids' tables",
          'Chairs',
          'Nursery decor',
        ],
      },
    ],
  },
  {
    group: 'Home & Living',
    sections: [
      {
        name: 'Home Textiles',
        items: ['Bedding', 'Blankets', 'Curtains', 'Cushions', 'Towels', 'Tablecloths', 'Rugs'],
      },
      {
        name: 'Tableware & Cookware',
        items: [
          'Plates',
          'Bowls',
          'Glasses',
          'Mugs',
          'Cutlery',
          'Pots',
          'Pans',
          'Bakeware',
          'Kitchen tools',
        ],
      },
      {
        name: 'Small Kitchen Appliances',
        items: ['Blenders', 'Toasters', 'Coffee makers', 'Kettles', 'Juicers'],
      },
      {
        name: 'Home Decor',
        items: [
          'Candles',
          'Vases',
          'Picture frames',
          'Mirrors',
          'Wall art',
          'Clocks',
          'Seasonal and holiday decorations',
        ],
      },
      {
        name: 'Storage & Organization',
        items: ['Baskets', 'Boxes', 'Clothes racks', 'Hooks', 'Organizers'],
      },
      {
        name: 'Furniture',
        items: [
          'Tables',
          'Desks',
          'Chairs',
          'Stools',
          'Cupboards',
          'Dressers',
          'Wardrobes',
          'Small shelving units',
        ],
      },
      {
        name: 'Home Improvement',
        items: ['Small DIY tools', 'Hardware', 'Office supplies', 'Garden and outdoor equipment'],
      },
    ],
  },
  {
    group: 'Electronics',
    sections: [
      {
        name: 'Computer & Tech',
        items: [
          'Laptops',
          'Tablets',
          'E-readers',
          'Desktop parts',
          'Cables',
          'Adapters',
        ],
      },
      {
        name: 'Mobile Devices',
        items: ['Mobile phones', 'Smartwatches', 'Fitness trackers', 'Phone cases', 'Chargers'],
      },
      {
        name: 'Audio & Video',
        items: [
          'Headphones',
          'Earbuds',
          'Speakers',
          'Hi-Fi systems',
          'Media players',
          'Cameras',
          'Lenses',
          'Small TVs',
        ],
      },
      {
        name: 'Gaming',
        items: [
          'Video game consoles',
          'Controllers',
          'Headsets',
          'Gaming accessories',
        ],
      },
      {
        name: 'Personal Care Electronics',
        items: ['Hair dryers', 'Straighteners', 'Electric shavers', 'Epilators'],
      },
    ],
  },
  {
    group: 'Entertainment',
    sections: [
      {
        name: 'Books & Magazines',
        items: [
          'Fiction',
          'Non-fiction',
          'Textbooks',
          "Children's books",
          'Comic books',
          'Manga',
          'Lifestyle magazines',
        ],
      },
      {
        name: 'Music Media',
        items: ['Vinyl records', 'CDs', 'Music cassettes'],
      },
      {
        name: 'Video Media',
        items: ['Video games', 'DVDs', 'Blu-ray discs'],
      },
    ],
  },
  {
    group: 'Hobbies & Collectibles',
    sections: [
      {
        name: 'Games & Hobbies',
        items: [
          'Board games',
          'Puzzles',
          'Tabletop and miniature gaming',
          'Trading cards',
        ],
      },
      {
        name: 'Arts & Crafts',
        items: [
          'Sewing supplies',
          'Knitting wool',
          'Fabrics',
          'Paint',
          'Drawing tools',
          'Scrapbooking materials',
        ],
      },
      {
        name: 'Collectibles',
        items: [
          'Memorabilia',
          'Stamps',
          'Coins',
          'Banknotes',
          'Postcards',
          "Collectors' storage items",
        ],
      },
      {
        name: 'Musical Instruments',
        items: ['Guitars', 'Keyboards', 'Wind instruments', 'Instrument accessories'],
      },
    ],
  },
  {
    group: 'Sports & Outdoors',
    sections: [
      {
        name: 'Sportswear',
        items: ['Sports tops', 'Leggings', 'Tracksuits', 'Ski wear', 'Swimwear'],
      },
      {
        name: 'Equipment',
        items: [
          'Cycling gear',
          'Running gear',
          'Yoga gear',
          'Fitness gear',
          'Tennis gear',
          'Golf gear',
          'Skateboarding gear',
          'Water sports gear',
          'Winter sports gear',
        ],
      },
    ],
  },
  {
    group: 'Pet Care',
    sections: [
      {
        name: 'Dogs & Cats',
        items: [
          'Pet clothing',
          'Collars',
          'Leashes',
          'Harnesses',
          'Pet beds',
          'Pet blankets',
          'Pet toys',
          'Bowls',
          'Feeders',
          'Carriers',
        ],
      },
      {
        name: 'Small Pets & Fish',
        items: ['Cages', 'Habitats', 'Aquarium decorations', 'Terrarium accessories'],
      },
    ],
  },
];

const slug = (text: string) =>
  text
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

function buildCategories(): VintedCategoryEntry[] {
  const list = [];
  for (const { group, sections } of TREE) {
    const groupSlug = slug(group);
    for (const section of sections) {
      const sectionSlug = slug(section.name);
      for (const item of section.items) {
        const id = `${groupSlug}.${sectionSlug}.${slug(item)}`;
        list.push({
          id,
          label: item,
          group,
          section: section.name,
          path: `${group} › ${section.name} › ${item}`,
        });
      }
    }
  }
  return list;
}

export const VINTED_CATEGORIES = buildCategories();

export const VINTED_CATEGORY_IDS = VINTED_CATEGORIES.map((c) => c.id);

const BY_ID = new Map(VINTED_CATEGORIES.map((c) => [c.id, c]));

export function isValidVintedCategoryId(id: string) {
  return typeof id === 'string' && BY_ID.has(id);
}

export function vintedCategoryById(id: string) {
  return BY_ID.get(id) ?? null;
}

/** Compact list for the category-suggestion prompt. */
export function vintedCategoryPromptBlock() {
  return VINTED_CATEGORIES.map((c) => `${c.id} = ${c.path}`).join('\n');
}

export function searchVintedCategories(query: string, limit = 80) {
  const needle = query.trim().toLowerCase();
  if (!needle) return VINTED_CATEGORIES;
  const matches = VINTED_CATEGORIES.filter((c) => {
    const hay = `${c.path} ${c.id}`.toLowerCase();
    return hay.includes(needle);
  });
  return matches.slice(0, limit);
}
