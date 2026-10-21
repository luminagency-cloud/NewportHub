/**
 * Starting category tree: parents, subcategories, and the source (Google Maps / Outscraper)
 * category names that map to each. `npm run seed:categories:*` writes it to the database, adding
 * what is missing and never deleting. Once categories are managed in admin (Linear LA-189), the
 * database is the source of truth and this file only seeds a fresh database.
 *
 * Draft from 2026-10-19 (Linear LA-188): check against the real Outscraper export, then adjust.
 * Aliases are matched case-insensitively (see aliasKey). A listing maps to the first alias hit on
 * its main category, then its subtypes. Parent aliases put a listing on the parent itself
 * ("general"), with no subcategory label.
 * `search` lists the Outscraper search terms for this parent; scripts/outscraper-queries.ts turns
 * them into queries for each town.
 */
export interface TaxonomySub {
  name: string;
  aliases: string[];
}
export interface TaxonomyParent {
  name: string;
  /** Key in src/lib/category-icons.ts. Subcategories show their parent's icon. */
  icon: string;
  aliases: string[];
  search: string[];
  subs: TaxonomySub[];
}

/** Towns we import. Google Maps also returns neighbours (Fall River, Westport…); those are skipped. */
export const SERVICE_TOWNS = ['Newport', 'Middletown', 'Portsmouth', 'Jamestown', 'Tiverton', 'Little Compton'] as const;
export const SERVICE_STATE = 'RI';

export const TAXONOMY: TaxonomyParent[] = [
  {
    name: 'Restaurants',
    icon: 'utensils',
    aliases: ['restaurant', 'family restaurant', 'fine dining restaurant', 'bistro', 'brasserie', 'diner', 'food court', 'takeout restaurant', 'delivery restaurant', 'new american restaurant', 'modern european restaurant', 'european restaurant', 'vegan restaurant', 'vegetarian restaurant', 'health food restaurant', 'fusion restaurant', 'lunch restaurant', 'new england restaurant'],
    search: ['restaurant', 'seafood restaurant', 'pizza restaurant', 'italian restaurant', 'mexican restaurant', 'sushi restaurant', 'chinese restaurant', 'thai restaurant', 'indian restaurant', 'american restaurant', 'breakfast restaurant', 'sandwich shop', 'food truck'],
    subs: [
      { name: 'Seafood Restaurants', aliases: ['seafood restaurant', 'oyster bar restaurant', 'lobster restaurant', 'fish and chips restaurant', 'raw bar'] },
      { name: 'Pizza', aliases: ['pizza restaurant', 'pizza takeout', 'pizza delivery', 'pizzeria'] },
      { name: 'Italian Restaurants', aliases: ['italian restaurant', 'northern italian restaurant', 'southern italian restaurant'] },
      { name: 'Mexican & Latin Restaurants', aliases: ['mexican restaurant', 'taco restaurant', 'burrito restaurant', 'latin american restaurant', 'tex-mex restaurant', 'brazilian restaurant', 'cuban restaurant'] },
      { name: 'Sushi & Japanese Restaurants', aliases: ['sushi restaurant', 'japanese restaurant', 'ramen restaurant', 'poke bar'] },
      { name: 'Chinese Restaurants', aliases: ['chinese restaurant', 'cantonese restaurant', 'szechuan restaurant', 'dim sum restaurant'] },
      { name: 'Asian Restaurants', aliases: ['asian restaurant', 'asian fusion restaurant', 'thai restaurant', 'vietnamese restaurant', 'korean restaurant', 'indian restaurant', 'pan-asian restaurant'] },
      { name: 'American Restaurants', aliases: ['american restaurant', 'traditional american restaurant', 'hamburger restaurant', 'steak house', 'barbecue restaurant', 'chicken wings restaurant', 'bar and grill', 'grill'] },
      { name: 'Breakfast & Brunch', aliases: ['breakfast restaurant', 'brunch restaurant', 'pancake restaurant'] },
      { name: 'Sandwiches & Delis', aliases: ['sandwich shop', 'deli', 'bagel shop', 'hot dog restaurant', 'sub shop'] },
      { name: 'Fast Food', aliases: ['fast food restaurant', 'chicken restaurant', 'fried chicken takeaway'] },
      { name: 'Mediterranean & Greek Restaurants', aliases: ['mediterranean restaurant', 'greek restaurant', 'middle eastern restaurant', 'lebanese restaurant', 'turkish restaurant', 'french restaurant', 'portuguese restaurant', 'spanish restaurant', 'tapas restaurant'] },
      { name: 'Food Trucks', aliases: ['food truck', 'mobile caterer'] },
    ],
  },
  {
    name: 'Coffee Shops',
    icon: 'coffee',
    aliases: ['coffee shop', 'cafe', 'espresso bar', 'coffee roasters', 'tea house'],
    search: ['coffee shop', 'cafe'],
    subs: [
      { name: 'Juice & Smoothie Bars', aliases: ['juice shop', 'smoothie shop', 'acai shop'] },
    ],
  },
  {
    name: 'Bakeries',
    icon: 'croissant',
    aliases: ['bakery', 'pastry shop', 'cake shop', 'cupcake shop', 'bagel bakery'],
    search: ['bakery', 'donut shop'],
    subs: [
      { name: 'Donut Shops', aliases: ['donut shop'] },
    ],
  },
  {
    name: 'Ice Cream & Desserts',
    icon: 'ice-cream',
    aliases: ['ice cream shop', 'frozen yogurt shop', 'dessert shop', 'gelato shop', 'chocolate shop', 'candy store', 'confectionery store'],
    search: ['ice cream shop'],
    subs: [],
  },

  {
    name: 'Bars & Nightlife',
    icon: 'martini',
    aliases: ['bar', 'lounge'],
    search: ['bar', 'pub', 'brewery', 'winery', 'cocktail bar', 'night club'],
    subs: [
      { name: 'Pubs & Taverns', aliases: ['pub', 'irish pub', 'tavern', 'sports bar', 'gastropub'] },
      { name: 'Cocktail & Wine Bars', aliases: ['cocktail bar', 'wine bar', 'piano bar', 'hotel bar'] },
      { name: 'Breweries & Distilleries', aliases: ['brewery', 'brewpub', 'distillery', 'beer hall', 'beer garden'] },
      { name: 'Wineries & Vineyards', aliases: ['winery', 'vineyard'] },
      { name: 'Night Clubs & Live Music', aliases: ['night club', 'live music venue', 'dance club', 'karaoke bar', 'comedy club'] },
    ],
  },
  {
    name: 'Hotels & Lodging',
    icon: 'bed',
    aliases: ['lodging'],
    search: ['hotel', 'inn', 'bed and breakfast', 'motel', 'vacation home rental agency', 'campground'],
    subs: [
      { name: 'Hotels & Resorts', aliases: ['hotel', 'resort hotel', 'boutique hotel', 'extended stay hotel'] },
      { name: 'Inns & Bed and Breakfasts', aliases: ['inn', 'bed and breakfast', 'guest house'] },
      { name: 'Motels', aliases: ['motel'] },
      { name: 'Vacation Rentals', aliases: ['vacation home rental agency', 'vacation rental', 'cottage rental', 'holiday apartment rental', 'short term apartment rental agency'] },
      { name: 'Campgrounds & RV Parks', aliases: ['campground', 'rv park'] },
    ],
  },
  {
    name: 'Things to Do',
    icon: 'landmark',
    aliases: ['tourist attraction'],
    search: ['tourist attraction', 'museum', 'tour operator', 'art gallery', 'bowling alley', 'movie theater', 'golf course'],
    subs: [
      { name: 'Museums & Historic Sites', aliases: ['museum', 'historical landmark', 'historical place museum', 'history museum', 'art museum', 'historic site', 'mansion'] },
      { name: 'Tours', aliases: ['tour operator', 'sightseeing tour agency', 'walking tour', 'trolley tour'] },
      { name: 'Art Galleries', aliases: ['art gallery', 'art studio'] },
      { name: 'Entertainment', aliases: ['movie theater', 'bowling alley', 'amusement center', 'escape room center', 'performing arts theater', 'theater company', 'video arcade', 'mini golf course'] },
      { name: 'Golf', aliases: ['golf course', 'golf club', 'golf driving range', 'public golf course'] },
      { name: 'Parks & Beaches', aliases: ['park', 'beach', 'state park', 'nature preserve', 'hiking area'] },
    ],
  },
  {
    name: 'Boating & Marine',
    icon: 'sailboat',
    aliases: [],
    search: ['marina', 'boat rental service', 'fishing charter', 'sailing school', 'boat repair shop', 'yacht broker', 'boat dealer'],
    subs: [
      { name: 'Marinas & Yacht Clubs', aliases: ['marina', 'yacht club', 'boat storage facility', 'mooring service'] },
      { name: 'Boat Rentals & Charters', aliases: ['boat rental service', 'yacht charter', 'boat tour agency', 'fishing charter', 'sailing charter', 'kayak rental', 'paddleboard rental'] },
      { name: 'Sailing Schools', aliases: ['sailing school', 'sailing club', 'boating instructor'] },
      { name: 'Boat Repair & Service', aliases: ['boat repair shop', 'marine engine repair', 'boatyard', 'boat detailing service', 'rigging service', 'sail maker'] },
      { name: 'Boat Dealers & Brokers', aliases: ['boat dealer', 'yacht broker', 'marine supply store', 'boat accessories supplier'] },
    ],
  },
  {
    name: 'Weddings & Events',
    icon: 'gem',
    aliases: [],
    search: ['wedding venue', 'event venue', 'caterer', 'wedding photographer', 'florist', 'event planner', 'dj service'],
    subs: [
      { name: 'Wedding & Event Venues', aliases: ['wedding venue', 'event venue', 'banquet hall', 'function room facility'] },
      { name: 'Caterers', aliases: ['caterer', 'catering food and drink supplier'] },
      { name: 'Photographers & Videographers', aliases: ['wedding photographer', 'photographer', 'videographer', 'photography studio'] },
      { name: 'Florists', aliases: ['florist', 'flower designer', 'flower market'] },
      { name: 'Event Planners & Rentals', aliases: ['event planner', 'wedding planner', 'party equipment rental service', 'tent rental service', 'bridal shop'] },
      { name: 'DJs & Entertainers', aliases: ['dj service', 'band', 'musician', 'entertainer'] },
    ],
  },
  {
    name: 'Shopping',
    icon: 'shopping-bag',
    aliases: ['store', 'shopping mall', 'shop'],
    search: ['clothing store', 'gift shop', 'jewelry store', 'boutique', 'book store', 'furniture store', 'antique store', 'hardware store', 'sporting goods store'],
    subs: [
      { name: 'Clothing & Boutiques', aliases: ['clothing store', 'boutique', "women's clothing store", "men's clothing store", "children's clothing store", 'shoe store', 'swimwear store', 'thrift store', 'consignment shop'] },
      { name: 'Gifts & Souvenirs', aliases: ['gift shop', 'souvenir store', 'novelty store', 'card shop', 'toy store', 'greeting card shop'] },
      { name: 'Jewelry', aliases: ['jewelry store', 'jeweler', 'jewelry designer'] },
      { name: 'Books & Music', aliases: ['book store', 'used book store', 'record store', 'music store'] },
      { name: 'Home & Furniture', aliases: ['furniture store', 'home goods store', 'interior designer', 'lighting store', 'mattress store', 'kitchen supply store'] },
      { name: 'Antiques & Art Supplies', aliases: ['antique store', 'antique furniture store', 'art supply store', 'craft store', 'frame shop'] },
      { name: 'Hardware & Garden', aliases: ['hardware store', 'garden center', 'nursery', 'paint store', 'home improvement store'] },
      { name: 'Sporting Goods & Outdoors', aliases: ['sporting goods store', 'surf shop', 'bicycle shop', 'outdoor sports store', 'fishing store', 'dive shop'] },
    ],
  },
  {
    name: 'Food & Drink Shops',
    icon: 'basket',
    aliases: ['food store'],
    search: ['grocery store', 'seafood market', 'liquor store', 'wine store', 'butcher shop', 'farmers market', 'specialty food store'],
    subs: [
      { name: 'Grocery Stores', aliases: ['grocery store', 'supermarket', 'convenience store', 'natural foods store', 'health food store', 'general store'] },
      { name: 'Seafood Markets', aliases: ['seafood market', 'fish store', 'lobster pound'] },
      { name: 'Wine & Spirits', aliases: ['liquor store', 'wine store', 'beer store'] },
      { name: 'Butchers & Specialty Foods', aliases: ['butcher shop', 'specialty food store', 'cheese shop', 'gourmet grocery store', 'olive oil store', 'spice store', 'food manufacturer', 'food producer'] },
      { name: 'Farms & Farmers Markets', aliases: ['farmers market', "farmers' market", 'farm', 'farm stand', 'produce market', 'orchard', 'farm shop'] },
    ],
  },
  {
    name: 'Health & Medical',
    icon: 'stethoscope',
    aliases: ['medical clinic', 'health'],
    search: ['doctor', 'dentist', 'orthodontist', 'urgent care center', 'pharmacy', 'physical therapist', 'chiropractor', 'optometrist'],
    subs: [
      { name: 'Doctors', aliases: ['doctor', 'family practice physician', 'internist', 'pediatrician', 'dermatologist', 'medical group', 'women\'s health clinic', 'obstetrician-gynecologist'] },
      { name: 'Dentists', aliases: ['dentist', 'dental clinic', 'cosmetic dentist', 'orthodontist', 'pediatric dentist', 'oral surgeon'] },
      { name: 'Urgent Care & Hospitals', aliases: ['urgent care center', 'hospital', 'emergency room', 'walk-in clinic'] },
      { name: 'Pharmacies', aliases: ['pharmacy', 'drug store'] },
      { name: 'Physical Therapy & Chiropractic', aliases: ['physical therapist', 'physical therapy clinic', 'chiropractor', 'occupational therapist', 'acupuncturist'] },
      { name: 'Eye Care', aliases: ['optometrist', 'ophthalmologist', 'optician', 'eye care center'] },
      { name: 'Mental Health & Counseling', aliases: ['psychologist', 'counselor', 'psychotherapist', 'mental health clinic', 'family counselor'] },
    ],
  },
  {
    name: 'Beauty & Wellness',
    icon: 'sparkles',
    aliases: ['beauty and wellness'],
    search: ['hair salon', 'barber shop', 'nail salon', 'day spa', 'massage therapist', 'gym', 'yoga studio', 'tattoo shop'],
    subs: [
      { name: 'Hair Salons', aliases: ['hair salon', 'beauty salon', 'hairdresser', 'hair stylist'] },
      { name: 'Barber Shops', aliases: ['barber shop'] },
      { name: 'Nail Salons', aliases: ['nail salon'] },
      { name: 'Spas & Massage', aliases: ['day spa', 'spa', 'massage therapist', 'massage spa', 'facial spa', 'skin care clinic', 'waxing hair removal service', 'medical spa'] },
      { name: 'Gyms & Fitness', aliases: ['gym', 'fitness center', 'personal trainer', 'pilates studio', 'boxing gym', 'crossfit gym', 'martial arts school'] },
      { name: 'Yoga Studios', aliases: ['yoga studio', 'meditation center'] },
      { name: 'Tattoo & Piercing', aliases: ['tattoo shop', 'piercing shop'] },
    ],
  },
  {
    name: 'Home Services',
    icon: 'wrench',
    aliases: [],
    search: ['plumber', 'electrician', 'hvac contractor', 'house cleaning service', 'landscaper', 'pest control service', 'roofing contractor', 'painter', 'locksmith', 'moving company'],
    subs: [
      { name: 'Plumbers', aliases: ['plumber', 'drainage service', 'water heater installation service'] },
      { name: 'Electricians', aliases: ['electrician', 'electrical installation service', 'generator shop'] },
      { name: 'Heating & Air Conditioning', aliases: ['hvac contractor', 'heating contractor', 'air conditioning contractor', 'heating oil supplier', 'propane supplier', 'chimney sweep'] },
      { name: 'Cleaning Services', aliases: ['house cleaning service', 'janitorial service', 'carpet cleaning service', 'window cleaning service', 'pressure washing service'] },
      { name: 'Landscaping & Tree Care', aliases: ['landscaper', 'landscape designer', 'lawn care service', 'tree service', 'snow removal service', 'irrigation equipment supplier'] },
      { name: 'Pest Control', aliases: ['pest control service', 'exterminator'] },
      { name: 'Roofing & Siding', aliases: ['roofing contractor', 'siding contractor', 'gutter cleaning service', 'gutter service'] },
      { name: 'Painters', aliases: ['painter', 'painting', 'wallpaper installer'] },
      { name: 'Locksmiths & Security', aliases: ['locksmith', 'security system supplier', 'alarm service'] },
      { name: 'Movers & Storage', aliases: ['moving company', 'mover', 'self-storage facility', 'storage facility', 'junk removal service'] },
    ],
  },
  {
    name: 'Builders & Contractors',
    icon: 'hard-hat',
    aliases: ['contractor'],
    search: ['general contractor', 'home builder', 'carpenter', 'excavating contractor', 'kitchen remodeler', 'architect'],
    subs: [
      { name: 'General Contractors', aliases: ['general contractor', 'construction company', 'building firm'] },
      { name: 'Home Builders', aliases: ['home builder', 'custom home builder'] },
      { name: 'Carpenters & Remodelers', aliases: ['carpenter', 'kitchen remodeler', 'bathroom remodeler', 'remodeler', 'cabinet maker', 'flooring contractor', 'deck builder'] },
      { name: 'Excavation & Masonry', aliases: ['excavating contractor', 'masonry contractor', 'paving contractor', 'concrete contractor', 'septic system service', 'well drilling contractor'] },
      { name: 'Architects & Engineers', aliases: ['architect', 'engineer', 'civil engineer', 'land surveyor', 'structural engineer'] },
    ],
  },
  {
    name: 'Automotive',
    icon: 'car',
    aliases: [],
    search: ['auto repair shop', 'car dealer', 'auto body shop', 'tire shop', 'car wash', 'gas station', 'towing service'],
    subs: [
      { name: 'Auto Repair', aliases: ['auto repair shop', 'mechanic', 'oil change service', 'brake shop', 'transmission shop', 'car inspection station', 'auto electrical service'] },
      { name: 'Car Dealers', aliases: ['car dealer', 'used car dealer', 'motorcycle dealer', 'auto broker'] },
      { name: 'Auto Body', aliases: ['auto body shop', 'auto glass shop', 'car detailing service'] },
      { name: 'Tires', aliases: ['tire shop', 'wheel alignment service'] },
      { name: 'Car Washes', aliases: ['car wash'] },
      { name: 'Gas Stations', aliases: ['gas station', 'ev charging station'] },
      { name: 'Auto Parts', aliases: ['auto parts store', 'racing car parts store', 'motorcycle parts store'] },
      { name: 'Towing', aliases: ['towing service', 'roadside assistance service'] },
      { name: 'Car Rentals & Taxis', aliases: ['car rental agency', 'taxi service', 'limousine service', 'airport shuttle service', 'transportation service'] },
    ],
  },
  {
    name: 'Professional Services',
    icon: 'briefcase',
    aliases: ['corporate office', 'business center'],
    search: ['lawyer', 'accountant', 'insurance agency', 'financial planner', 'bank', 'marketing agency'],
    subs: [
      { name: 'Lawyers', aliases: ['lawyer', 'attorney', 'law firm', 'real estate attorney', 'estate planning attorney', 'family law attorney', 'personal injury attorney', 'notary public'] },
      { name: 'Accountants & Tax', aliases: ['accountant', 'certified public accountant', 'tax preparation service', 'bookkeeping service', 'tax consultant'] },
      { name: 'Insurance', aliases: ['insurance agency', 'insurance broker', 'auto insurance agency'] },
      { name: 'Banks & Financial Advisors', aliases: ['bank', 'credit union', 'financial planner', 'financial consultant', 'investment service', 'mortgage lender', 'atm'] },
      { name: 'Marketing & Design', aliases: ['marketing agency', 'advertising agency', 'graphic designer', 'website designer', 'print shop', 'sign shop'] },
      { name: 'Computer & Phone Repair', aliases: ['computer repair service', 'cell phone store', 'computer store', 'it services'] },
    ],
  },
  {
    name: 'Real Estate',
    icon: 'house',
    aliases: [],
    search: ['real estate agency', 'property management company'],
    subs: [
      { name: 'Real Estate Agents', aliases: ['real estate agency', 'real estate agent', 'real estate consultant'] },
      { name: 'Property Management', aliases: ['property management company', 'apartment rental agency', 'apartment complex', 'condominium complex'] },
    ],
  },
  {
    name: 'Pets',
    icon: 'paw',
    aliases: [],
    search: ['veterinarian', 'pet groomer', 'pet store', 'dog trainer', 'kennel'],
    subs: [
      { name: 'Veterinarians', aliases: ['veterinarian', 'animal hospital', 'emergency veterinarian service'] },
      { name: 'Pet Grooming', aliases: ['pet groomer', 'dog groomer'] },
      { name: 'Pet Stores', aliases: ['pet store', 'pet supply store'] },
      { name: 'Dog Training, Boarding & Daycare', aliases: ['dog trainer', 'kennel', 'pet boarding service', 'dog day care center', 'pet sitter', 'dog walker'] },
    ],
  },
  {
    name: 'Education & Childcare',
    icon: 'graduation-cap',
    aliases: ['school'],
    search: ['day care center', 'preschool', 'private school', 'tutoring service', 'music school', 'dance school'],
    subs: [
      { name: 'Child Care & Preschools', aliases: ['day care center', 'child care agency', 'preschool', 'nursery school'] },
      { name: 'Schools', aliases: ['private school', 'elementary school', 'middle school', 'high school', 'college', 'university', 'charter school'] },
      { name: 'Tutoring', aliases: ['tutoring service', 'test preparation center', 'learning center'] },
      { name: 'Music, Dance & Art Lessons', aliases: ['music school', 'music instructor', 'dance school', 'art school', 'drama school', 'swimming school'] },
    ],
  },
  {
    name: 'Community & Nonprofits',
    icon: 'hand-heart',
    aliases: [],
    search: ['church', 'non-profit organization', 'community center'],
    subs: [
      { name: 'Places of Worship', aliases: ['church', 'catholic church', 'episcopal church', 'baptist church', 'methodist church', 'synagogue', 'place of worship', 'congregational church'] },
      { name: 'Nonprofits & Charities', aliases: ['non-profit organization', 'charity', 'foundation', 'social services organization', 'food bank', 'thrift store charity'] },
      { name: 'Community Centers & Clubs', aliases: ['community center', 'senior citizen center', 'youth organization', 'social club', 'veterans organization', 'library', 'public library'] },
    ],
  },
];
