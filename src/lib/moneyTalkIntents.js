const KEYWORD_RULES = [
  {
    category: "makan",
    keywords: [
      "kopi",
      "ngopi",
      "coffee",
      "espresso",
      "latte",
      "americano",
      "boba",
      "teh",
      "tea",
    ],
    responses: {
      id: {
        message:
          "Ngopi di {{title}}? Aku kebagian aromanya aja, {{amount}} langsung melayang. ☕💸",
        tip: "Bisa coba seduh kopi sendiri biar aku lebih sering nongkrong di dompet.",
      },
      en: {
        message:
          "Coffee run at {{title}}? I only got the aroma while {{amount}} flew away. ☕💸",
        tip: "Try brewing at home so I can hang around in your wallet longer.",
      },
    },
  },
  {
    category: "makan",
    keywords: ["ayam", "fried chicken", "burger", "pizza", "sushi", "ramen", "bakso", "steak"],
    responses: {
      id: {
        message: "Pesan {{title}}? Lidahmu pesta, aku ikut tersedot ke kasir. 🍽️💸",
        tip: "Atur jadwal makan spesial supaya saldo tetap aman.",
      },
      en: {
        message: "Ordered {{title}}? Your taste buds party while my balance pays the bill. 🍽️💸",
        tip: "Plan special meals so the budget stays on track.",
      },
    },
  },
  {
    category: "belanja",
    keywords: ["sepatu", "shoes", "sneaker", "sneakers", "heels", "sandals", "boots"],
    responses: {
      id: {
        message: "Belanja {{title}}? Dompetku ikut fashion show dadakan. 👟💸",
        tip: "Sisihkan dana outfit bulanan biar nggak kebablasan.",
      },
      en: {
        message: "Shopping for {{title}}? My balance jumped onto the runway too. 👟💸",
        tip: "Set a monthly outfit fund so spending stays in check.",
      },
    },
  },
  {
    category: "belanja",
    keywords: [
      "baju",
      "shirt",
      "dress",
      "jaket",
      "jacket",
      "hoodie",
      "outfit",
      "fashion",
      "pakaian",
      "kemeja",
      "celana",
      "pants",
    ],
    responses: {
      id: {
        message: "{{title}} baru? Aku juga harus ganti outfit karena makin tipis. 👗💸",
        tip: "Cek lemari dulu sebelum beli baju baru, siapa tau masih ada yang kece.",
      },
      en: {
        message: "New {{title}}? I need a fresh outfit too because I'm getting thinner. 👗💸",
        tip: "Shop your closet first—there might be gems before buying new clothes.",
      },
    },
  },
  {
    category: "belanja",
    keywords: ["hp", "phone", "laptop", "gadget", "camera", "kamera", "tablet", "pc", "monitor"],
    responses: {
      id: {
        message: "Upgrade {{title}}? Aku ikut ke-charge minus nih. 🔌💸",
        tip: "Pastikan ada pos gadget khusus supaya saldo nggak kaget.",
      },
      en: {
        message: "Upgrading {{title}}? My balance just lost a big charge. 🔌💸",
        tip: "Keep a dedicated gadget budget so surprises stay pleasant.",
      },
    },
  },
  {
    category: "transport",
    keywords: ["bensin", "fuel", "pertalite", "pertamax", "diesel", "gas", "shell"],
    responses: {
      id: {
        message: "Isi {{title}}? Tangki penuh, dompet setengah. ⛽😵",
        tip: "Coba catat jarak tempuh biar isi BBM lebih terencana.",
      },
      en: {
        message: "Filling up {{title}}? Tank's full but my balance is half. ⛽😵",
        tip: "Track your mileage so fuel stops become more predictable.",
      },
    },
  },
  {
    category: "transport",
    keywords: [
      "gojek",
      "grab",
      "uber",
      "taksi",
      "taxi",
      "ojek",
      "angkot",
      "bus",
      "mrt",
      "lrt",
      "kereta",
      "train",
      "angkut",
      "angkutan",
      "ojol",
    ],
    responses: {
      id: {
        message: "Perjalanan {{title}}? Aku ikut ngojek sampai saldo drop. 🚗💸",
        tip: "Gabungin beberapa tujuan sekaligus supaya ongkos lebih hemat.",
      },
      en: {
        message: "Ride with {{title}}? I tagged along and lost some weight. 🚗💸",
        tip: "Combine errands in one trip to save on transport costs.",
      },
    },
  },
  {
    category: "hiburan",
    keywords: [
      "netflix",
      "spotify",
      "disney",
      "vidio",
      "prime",
      "youtube",
      "viu",
      "apple tv",
      "apple music",
      "iqiyi",
    ],
    responses: {
      id: {
        message: "Langganan {{title}} jalan lagi? Aku cuma jadi penonton bayarannya. 📺💳",
        tip: "Pertimbangkan bagi akun bareng keluarga biar lebih hemat.",
      },
      en: {
        message: "Subscribed to {{title}} again? I'm the paying audience here. 📺💳",
        tip: "Share plans with family or friends to trim the cost.",
      },
    },
  },
  {
    category: "hiburan",
    keywords: [
      "game",
      "gaming",
      "steam",
      "playstation",
      "ps5",
      "ps4",
      "xbox",
      "nintendo",
      "mlbb",
      "valorant",
      "genshin",
      "diamond",
      "top up",
    ],
    responses: {
      id: {
        message: "Top up {{title}}? Aku jadi karakter NPC yang selalu bayar. 🎮💸",
        tip: "Tetapkan limit hiburan bulanan biar saldo nggak game over.",
      },
      en: {
        message: "Topping up {{title}}? I'm the NPC who keeps footing the bill. 🎮💸",
        tip: "Set a monthly entertainment cap so the balance doesn't game over.",
      },
    },
  },
  {
    category: "tagihan",
    keywords: ["listrik", "pln", "token", "electric", "power"],
    responses: {
      id: {
        message: "Bayar {{title}}? Rumah terang, tapi saldo meredup. 💡💸",
        tip: "Matikan alat listrik yang nggak terpakai untuk hemat daya.",
      },
      en: {
        message: "Paying {{title}}? Lights stay on while my balance dims. 💡💸",
        tip: "Switch off unused appliances to save on electricity.",
      },
    },
  },
  {
    category: "tagihan",
    keywords: ["internet", "wifi", "modem", "fiber", "indihome", "data"],
    responses: {
      id: {
        message: "Tagihan {{title}} tiba? Aku terhubung langsung ke pengeluaran. 📶💸",
        tip: "Cek paket yang dipakai, mungkin ada pilihan lebih hemat.",
      },
      en: {
        message: "{{title}} bill is here? I'm plugged straight into that expense. 📶💸",
        tip: "Review your plan—there might be a cheaper option that fits.",
      },
    },
  },
  {
    category: "tabungan",
    keywords: ["emas", "gold", "reksa", "fund", "mutual", "saham", "stock", "crypto", "bitcoin", "invest"],
    responses: {
      id: {
        message: "Investasi {{title}}? Aku lagi disekolahkan biar pintar berkembang. 📈💰",
        tip: "Diversifikasi biar tabungan nggak bergantung ke satu instrumen aja.",
      },
      en: {
        message: "Investing in {{title}}? I'm off to school to grow smarter. 📈💰",
        tip: "Diversify so your savings don't rely on a single instrument.",
      },
    },
  },
  {
    category: "tabungan",
    keywords: ["darurat", "emergency", "sinking fund", "cadangan", "dana"],
    responses: {
      id: {
        message: "{{title}} masuk tabungan? Aku diparkir manis buat jaga-jaga. 🛟💰",
        tip: "Pertahankan dana darurat 3-6 bulan biaya hidup ya!",
      },
      en: {
        message: "Adding {{title}} to savings? I'm parked safely for rainy days. 🛟💰",
        tip: "Keep your emergency fund at 3–6 months of living costs.",
      },
    },
  },
];

function buildTitleTriggerList(rules) {
  if (!Array.isArray(rules)) return [];
  const seen = new Set();
  const triggers = [];

  for (const rule of rules) {
    if (!Array.isArray(rule?.keywords)) continue;
    for (const keyword of rule.keywords) {
      if (typeof keyword !== "string") continue;
      const normalized = keyword.toLowerCase();
      if (seen.has(normalized)) continue;
      seen.add(normalized);
      triggers.push(keyword);
    }
  }

  return triggers.sort((a, b) => a.localeCompare(b));
}

export const MONEY_TALK_TITLE_TRIGGERS = Object.freeze(
  buildTitleTriggerList(KEYWORD_RULES)
);

function fillTemplate(template, values) {
  if (!template) return template;
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    const value = values?.[key];
    return value != null ? String(value) : "";
  });
}

function matchesRule(rule, title) {
  if (!rule || !title) return false;
  if (!Array.isArray(rule.keywords) || rule.keywords.length === 0) return false;
  const normalizedTitle = title.toLowerCase();
  return rule.keywords.some((keyword) => {
    if (!keyword) return false;
    if (keyword instanceof RegExp) return keyword.test(normalizedTitle);
    return normalizedTitle.includes(String(keyword).toLowerCase());
  });
}

export function resolveMoneyTalkIntent({ lang = "id", title, values }) {
  if (!title) return null;
  const rule = KEYWORD_RULES.find((item) => matchesRule(item, title));
  if (!rule) return null;
  const localized = rule.responses?.[lang] || rule.responses?.id || null;
  if (!localized) return null;
  const message = fillTemplate(localized.message, values);
  const tip = fillTemplate(localized.tip, values);
  return {
    message,
    tip,
  };
}

