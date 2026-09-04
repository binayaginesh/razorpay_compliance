// Deterministic mapping of synthetic account IDs to realistic Indian merchant names
// Preserves the real account_id underneath for all backend calls.

const REALISTIC_INDIAN_MERCHANTS = {
  // Clear / Healthy merchants
  "ACC_CLEAR_001": "Shree Balaji Enterprises",
  "ACC_CLEAR_002": "BlueDart Logistics India",
  "ACC_CLEAR_003": "QuickBite Cloud Kitchens",
  "ACC_CLEAR_004": "Vanguard Tech Solutions",
  "ACC_CLEAR_005": "FabIndia Crafts & Handlooms",
  "ACC_CLEAR_006": "Apna Bazaar Supermarket",
  "ACC_CLEAR_007": "Kaveri Silk Sarees Bangalore",
  "ACC_CLEAR_008": "Urban Clap Home Services",
  "ACC_CLEAR_009": "Zomato Partner Network",
  "ACC_CLEAR_010": "Nykaa Beauty Retail Hub",
  "ACC_CLEAR_011": "Croma Digital Electronics",
  "ACC_CLEAR_012": "Haldiram Foods & Sweets",
  "ACC_CLEAR_013": "Lenskart Eyewear Solutions",
  "ACC_CLEAR_014": "Tata 1mg Health Services",
  "ACC_CLEAR_015": "Swiggy Instamart Pod 104",
  "ACC_CLEAR_016": "FirstCry Baby Essentials",
  "ACC_CLEAR_017": "Pepperfry Furniture Depot",
  "ACC_CLEAR_018": "Blinkit Dark Store Pune",
  "ACC_CLEAR_019": "BigBasket Grocery Fulfilment",
  "ACC_CLEAR_020": "Titan Eyeplus Retail",
  "ACC_CLEAR_021": "CultFit Wellness Centers",
  "ACC_CLEAR_022": "BookMyShow Ticketing Network",
  "ACC_CLEAR_023": "Decathlon Sports India",
  "ACC_CLEAR_024": "Apollo Pharmacy Outlet 29",
  "ACC_CLEAR_025": "MedPlus Healthcare Services",

  // Chargeback ratio triggers
  "ACC_CHARGEBACK_001": "Glamour Luxe Jewelry Online",
  "ACC_CHARGEBACK_002": "SkyHigh Travel & Holidays",
  "ACC_CHARGEBACK_003": "NextGen Crypto Pay Gateway",
  "ACC_CHARGEBACK_004": "SpeedyGadgets Electronics",
  "ACC_CHARGEBACK_005": "Apex Forex Exchange Hub",
  "ACC_CHARGEBACK_006": "Elite Luxury Watch Imports",
  "ACC_CHARGEBACK_007": "DreamHoliday Tour Packages",
  "ACC_CHARGEBACK_008": "HyperDrive Gaming Credits",
  "ACC_CHARGEBACK_009": "FortuneGold Bullion Trade",
  "ACC_CHARGEBACK_010": "VapourTech Vaporizers Online",
  "ACC_CHARGEBACK_011": "SuperFast Ticket Booking Pvt",
  "ACC_CHARGEBACK_012": "ProGaming Skin Marketplace",

  // Volume spike triggers
  "ACC_VOLUME_001": "FlashFest Electronics Sale",
  "ACC_VOLUME_002": "ViralTrend Apparels Surat",
  "ACC_VOLUME_003": "MegaDeal Festive Hub",
  "ACC_VOLUME_004": "DiwaliDhamaka Offers Portal",
  "ACC_VOLUME_005": "InstantGold Token Network",
  "ACC_VOLUME_006": "MonsoonSale Wholesale Mart",
  "ACC_VOLUME_007": "CryptoDrop Airdrop Services",
  "ACC_VOLUME_008": "SuperSaver Gadget Mart",
  "ACC_VOLUME_009": "FastBuck Dropship India",
  "ACC_VOLUME_010": "SurgeLogistics Expressway",

  // KYC documentation gaps
  "ACC_KYC_001": "Anand Traders Chandni Chowk",
  "ACC_KYC_002": "DesiMart Online Wholesale",
  "ACC_KYC_003": "Lakshmi Global Export-Import",
  "ACC_KYC_004": "Om Sai Ram Medical Supplies",
  "ACC_KYC_005": "Bharat Logistics & Warehousing",
  "ACC_KYC_006": "Kisan Direct Farm Produce",
  "ACC_KYC_007": "Gupta Brothers Textiles Delhi",
  "ACC_KYC_008": "Shreeji Auto Components Rajkot",
  "ACC_KYC_009": "Jai Hind Retailers Kanpur",
  "ACC_KYC_010": "Venkateshwara Hardware Hub",

  // MCC mismatches
  "ACC_MCC_001": "Pooja Stationery & Books",
  "ACC_MCC_002": "Royal Cafe & Catering Services",
  "ACC_MCC_003": "Star Educational Tutorials",
  "ACC_MCC_004": "GreenLeaf Florist & Decorators",
  "ACC_MCC_005": "Modern Dry Cleaners & Dyers",
  "ACC_MCC_006": "Shanti Herbal Ayurvedic Spa",
  "ACC_MCC_007": "BrightSmile Dental Clinic",
  "ACC_MCC_008": "Sunrise Bakery & Confectionery",

  // Fraud linkage
  "ACC_FRAUD_001": "ShadowTrade Logistics LLP",
  "ACC_FRAUD_002": "GhostNet Payment Intermediary",
  "ACC_FRAUD_003": "BlackRock MicroLoans Tech",
  "ACC_FRAUD_004": "PhishGuard Security Portal",
  "ACC_FRAUD_005": "DarkWeb Affiliate Marketing",
  "ACC_FRAUD_006": "ProxyPay Remittance Services",

  // Ambiguous & Conflicting Signals
  "ACC_AMBIGUOUS_001": "Kaveri Agro Tech Innovations",
  "ACC_AMBIGUOUS_002": "Himalaya Herbal Remedies",
  "ACC_AMBIGUOUS_003": "Vedic Life Wellness Retreat",
  "ACC_AMBIGUOUS_004": "Zenith Cloud SaaS Solutions",
  "ACC_AMBIGUOUS_005": "MetroCity Coworking Spaces",

  // Insufficient Data
  "ACC_INSUFFICIENT_001": "Newbie Tech Ventures LLP",
  "ACC_INSUFFICIENT_002": "FreshLaunch AI Labs Bangalore",
  "ACC_INSUFFICIENT_003": "StealthMode Fintech Sandbox",
  "ACC_INSUFFICIENT_004": "BetaTester Digital Payments",
  "ACC_INSUFFICIENT_005": "EarlyStage Commerce Pilot",
};

const CITY_POOL = [
  "Bengaluru, KA",
  "Mumbai, MH",
  "Delhi NCR",
  "Hyderabad, TS",
  "Chennai, TN",
  "Pune, MH",
  "Kolkata, WB",
  "Ahmedabad, GJ",
  "Jaipur, RJ",
  "Surat, GJ",
  "Indore, MP",
  "Chandigarh, PB",
];

const CATEGORY_MAP = {
  kyc_documentation_gap: "Proprietorship / MSME",
  volume_spike: "E-Commerce / Retail",
  chargeback_ratio: "Digital Goods / Travel",
  mcc_mismatch: "Services / Consulting",
  third_party_fraud_linkage: "Financial Intermediary",
  healthy: "Verified Enterprise",
  unknown: "General Merchant",
};

// Deterministic hash to pick a realistic name if not explicitly in table
function hashString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

const BUSINESS_PREFIXES = [
  "Shree", "Mahalaxmi", "Balaji", "Om", "Apex", "Zenith", "Vanguard",
  "Bharat", "Indo", "Swadeshi", "FastTrack", "Kaveri", "Ganga", "Sunrise",
  "Lotus", "Royal", "Prime", "Metro", "NextGen", "Desi"
];

const BUSINESS_SUFFIXES = [
  "Enterprises", "Solutions Pvt Ltd", "Logistics LLP", "Technologies",
  "Retail Hub", "India Mart", "Infra & Trading", "Commerce Lab",
  "Digital Services", "Wholesale Distributors", "Direct", "Networks"
];

export function getMerchantDisplayName(account) {
  if (!account) return "Unknown Merchant";
  const id = account.account_id;
  if (REALISTIC_INDIAN_MERCHANTS[id]) {
    return REALISTIC_INDIAN_MERCHANTS[id];
  }

  // If the merchant_name exists and looks like a real business (not synthetic generic)
  if (account.merchant_name && !account.merchant_name.includes("Merchant") && !account.merchant_name.includes("ACC_")) {
    return account.merchant_name;
  }

  // Deterministically generate a realistic name based on account_id
  const h = hashString(id);
  const prefix = BUSINESS_PREFIXES[h % BUSINESS_PREFIXES.length];
  const suffix = BUSINESS_SUFFIXES[(h >> 3) % BUSINESS_SUFFIXES.length];
  return `${prefix} ${suffix}`;
}

export function getMerchantLocation(account) {
  if (!account) return "India";
  const h = hashString(account.account_id || "acc");
  return CITY_POOL[h % CITY_POOL.length];
}

export function getMerchantCategory(trigger) {
  return CATEGORY_MAP[trigger] || "Merchant Services";
}

export function getMerchantInitials(name) {
  if (!name) return "MP";
  const parts = name.split(" ").filter(p => p.length > 0 && !["Pvt", "Ltd", "LLP", "&"].includes(p));
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return (name.slice(0, 2)).toUpperCase();
}
