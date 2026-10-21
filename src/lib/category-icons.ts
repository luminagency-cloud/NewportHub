// Category icons (Lucide, ISC licence). The key is stored in categories.icon; a subcategory
// without its own icon shows its parent's, and a category without either shows DEFAULT_ICON.
import {
  Anchor, Baby, BedDouble, Beer, Bike, BookOpen, Briefcase, Building2, CakeSlice, Calculator, Camera, Car,
  Church, Coffee, Croissant, Dog, Drama, Dumbbell, Fish, Flower2, Fuel, Gem, Gift, GraduationCap, Hammer,
  HandHeart, HardHat, Hospital, House, IceCreamCone, Key, Landmark, Laptop, Leaf, MapPin, Martini, Music,
  Paintbrush, Palette, PawPrint, Pill, Pizza, Sailboat, Sandwich, Scale, Scissors, Shield, Ship, Shirt,
  ShoppingBag, ShoppingBasket, Sparkles, Stethoscope, Store, Ticket, Trees, Truck, Utensils, Waves, Wine,
  Wrench, Zap,
} from 'lucide-static';

/** key → [label for the admin picker, SVG markup]. Add an icon here to make it pickable. */
export const CATEGORY_ICONS = {
  store: ['Shop (default)', Store],
  utensils: ['Restaurant', Utensils],
  fish: ['Seafood', Fish],
  pizza: ['Pizza', Pizza],
  sandwich: ['Sandwich', Sandwich],
  coffee: ['Coffee', Coffee],
  croissant: ['Bakery', Croissant],
  'cake-slice': ['Cake', CakeSlice],
  'ice-cream': ['Ice cream', IceCreamCone],
  martini: ['Cocktails', Martini],
  wine: ['Wine', Wine],
  beer: ['Beer', Beer],
  bed: ['Lodging', BedDouble],
  landmark: ['Landmark', Landmark],
  ticket: ['Tickets', Ticket],
  drama: ['Theatre', Drama],
  music: ['Music', Music],
  palette: ['Art', Palette],
  camera: ['Photography', Camera],
  sailboat: ['Sailing', Sailboat],
  ship: ['Ship', Ship],
  anchor: ['Anchor', Anchor],
  waves: ['Beach', Waves],
  trees: ['Outdoors', Trees],
  bike: ['Bikes', Bike],
  gem: ['Weddings', Gem],
  gift: ['Gifts', Gift],
  'shopping-bag': ['Shopping', ShoppingBag],
  basket: ['Groceries', ShoppingBasket],
  shirt: ['Clothing', Shirt],
  stethoscope: ['Medical', Stethoscope],
  hospital: ['Hospital', Hospital],
  pill: ['Pharmacy', Pill],
  sparkles: ['Beauty', Sparkles],
  scissors: ['Hair', Scissors],
  dumbbell: ['Fitness', Dumbbell],
  flower: ['Flowers', Flower2],
  leaf: ['Garden', Leaf],
  wrench: ['Repairs', Wrench],
  zap: ['Electrical', Zap],
  paintbrush: ['Painting', Paintbrush],
  hammer: ['Building', Hammer],
  'hard-hat': ['Contractor', HardHat],
  truck: ['Moving', Truck],
  car: ['Cars', Car],
  fuel: ['Fuel', Fuel],
  briefcase: ['Business', Briefcase],
  scale: ['Legal', Scale],
  calculator: ['Accounting', Calculator],
  shield: ['Insurance', Shield],
  laptop: ['Tech', Laptop],
  building: ['Office', Building2],
  house: ['Real estate', House],
  key: ['Rentals', Key],
  paw: ['Pets', PawPrint],
  dog: ['Dogs', Dog],
  'graduation-cap': ['School', GraduationCap],
  book: ['Books', BookOpen],
  baby: ['Childcare', Baby],
  church: ['Church', Church],
  'hand-heart': ['Community', HandHeart],
  'map-pin': ['Place', MapPin],
} as const;

export type CategoryIconKey = keyof typeof CATEGORY_ICONS;
export const DEFAULT_ICON: CategoryIconKey = 'store';

export const isIconKey = (key: unknown): key is CategoryIconKey => typeof key === 'string' && Object.hasOwn(CATEGORY_ICONS, key);

/** The icon a category shows: its own, else its parent's, else the default. */
export function iconFor(own: string | null | undefined, parent?: string | null): CategoryIconKey {
  if (isIconKey(own)) return own;
  if (isIconKey(parent)) return parent;
  return DEFAULT_ICON;
}

export const iconSvg = (key: CategoryIconKey) => CATEGORY_ICONS[key][1];
