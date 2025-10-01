export const quotes = {
  id: {
    Makan: [
      "Aku masuk mulut, bukan dompet! 🍜",
      "Habis makan enak, aku langsung melangsing. 😅",
      "Perut kenyang, dompet kempes!",
      "Makan lagi? Aku butuh diet.",
      "Setiap gigitan, aku semakin tipis.",
      "Aku lebih suka disimpan daripada dimakan.",
    ],
    Transport: [
      "Wusshh! Aku ikut ngebut. 🚗",
      "Aku capek jadi uang ojek.",
      "Bensin lagi? Aku kan bukan minyak.",
      "Mungkin coba jalan kaki?",
      "Tiap kilometer, aku berpamitan.",
      "Bis kan murah? hemat dong.",
    ],
    Hiburan: [
      "Yay, diajak bersenang-senang!",
      "Tiket lagi? Aku ingin liburan juga.",
      "Nonton boleh, asal aku nggak habis.",
      "Game baru? Ingat cicilan!",
      "Aku tertawa, tapi sambil nangis.",
      "Seru-seru, tapi tabungan melambai.",
    ],
    Belanja: [
      "Keranjangmu penuh, aku kosong.",
      "Diskon? Aku tetap keluar.",
      "Belanja terus, aku pusing.",
      "Mungkin cari yang second?",
      "Aku berharap kita cuma window shopping.",
      "Barang baru lagi? Aku belum pulih.",
    ],
    Tagihan: [
      "Halo, bulan ini aku datang lagi.",
      "Bayar listrik biar terang, tapi aku gelap.",
      "Tagihan air? Aku mengalir deras.",
      "Aku pergi begitu saja tiap tanggal tua.",
      "Langganan banyak, aku seret.",
      "Mungkin matikan lampu kalau tidak dipakai.",
    ],
    Tabungan: [
      "Tidur dulu ya, bangunkan nanti.",
      "Aku berkembang di sini.",
      "Hemat pangkal kaya, ayo!",
      "Aku senang di celengan.",
      "Tambah lagi dong biar gemuk.",
      "Pelan-pelan jadi bukit.",
    ],
  },
  en: {
    Makan: [
      "I go to your belly, not your wallet! 🍜",
      "Great meal, sudden slim wallet. 😅",
      "Full tummy, empty pocket!",
      "Eating again? I need a diet.",
      "Every bite makes me thinner.",
      "I'd rather be saved than eaten.",
    ],
    Transport: [
      "Zoom! I'm speeding away. 🚗",
      "Tired of being ride money.",
      "Fuel again? I'm not oil.",
      "Maybe try walking?",
      "Each kilometer, I say goodbye.",
      "Buses are cheaper, you know.",
    ],
    Hiburan: [
      "Yay, out for fun!",
      "Tickets again? I need a vacation too.",
      "Movies are fine, just don't spend me all.",
      "New game? Remember the bills!",
      "I'm laughing while crying inside.",
      "Fun times, waving goodbye to savings.",
    ],
    Belanja: [
      "Your cart is full, I'm empty.",
      "Sale? I'm still leaving.",
      "Shopping spree makes me dizzy.",
      "Maybe buy second-hand?",
      "I hoped it was just window shopping.",
      "Another new item? I'm not recovered yet.",
    ],
    Tagihan: [
      "Hello, it's that time of month.",
      "Paying electricity, but I'm in the dark.",
      "Water bill? I'm flowing fast.",
      "I vanish every due date.",
      "Too many subscriptions drain me.",
      "Turn off unused lights maybe?",
    ],
    Tabungan: [
      "Let me sleep for the future.",
      "I'm growing safely here.",
      "Save now, rich later!",
      "Happy inside the piggy bank.",
      "Feed me more to grow fat.",
      "Slowly but surely I pile up.",
    ],
  },
};

export const tips = {
  id: {
    Makan: [
      "Coba masak sendiri untuk lebih hemat.",
      "Bawa bekal dari rumah.",
    ],
    Transport: [
      "Gunakan transportasi umum saat bisa.",
      "Jadwalkan carpool dengan teman.",
    ],
    Hiburan: [
      "Cari hiburan gratis atau diskon.",
      "Batasi langganan yang jarang dipakai.",
    ],
    Belanja: [
      "Buat daftar belanja dan patuhi.",
      "Tunggu 24 jam sebelum membeli barang mahal.",
    ],
    Tagihan: [
      "Matikan alat listrik saat tidak digunakan.",
      "Tinjau langganan bulananmu.",
    ],
    Tabungan: [
      "Setor otomatis tiap bulan.",
      "Pisahkan rekening tabungan.",
    ],
  },
  en: {
    Makan: [
      "Cook at home to save more.",
      "Bring your own lunch.",
    ],
    Transport: [
      "Use public transport when possible.",
      "Arrange carpools with friends.",
    ],
    Hiburan: [
      "Look for free or discounted fun.",
      "Trim unused subscriptions.",
    ],
    Belanja: [
      "Make a shopping list and stick to it.",
      "Wait 24 hours before big purchases.",
    ],
    Tagihan: [
      "Turn off appliances when unused.",
      "Review your monthly subscriptions.",
    ],
    Tabungan: [
      "Automate monthly deposits.",
      "Keep a separate savings account.",
    ],
  },
};

export const special = {
  id: {
    high: "Kenapa aku dibelikan mahal-mahal? 😵",
    savings: "Nice! Aku disimpan buat masa depan 💰✨",
    overbudget: "Aku capek dipakai terus… istirahat dulu ya 😭",
  },
  en: {
    high: "Why am I bought so pricey? 😵",
    savings: "Nice! I'm saved for the future 💰✨",
    overbudget: "I'm tired of being spent… give me a break 😭",
  },
};

const dynamicTemplates = {
  id: {
    expense: [
      {
        max: 50000,
        templates: [
          "Cuma {amount}? Dompet cuma yoga ringan.",
          "Belanja {category} segini mah masih bikin aku cekikikan.",
          "Aku anggap {amount} ini cemilan aja.",
        ],
      },
      {
        max: 200000,
        templates: [
          "Oke, {amount} buat {category}. Dompet mulai keringetan dikit.",
          "{amount} melayang. Tolong bilang {category} ini worth it.",
          "Transaksi {category} segini bikin aku tarik napas panjang.",
        ],
      },
      {
        max: Infinity,
        templates: [
          "Waduh {amount}! Dompet langsung teriak ke bantal.",
          "{amount} buat {category}? Aku siap drama FTV.",
          "Transfer segede {amount}? Bantu kipasin dompet, please.",
        ],
      },
    ],
    income: [
      {
        max: 100000,
        templates: [
          "Yeay dapet {amount}! Kecil-kecil cabe rawit.",
          "Saldo nambah {amount}. Aku goyang tipis-tipis.",
          "{amount} masuk, lumayan buat senyum 5 menit.",
        ],
      },
      {
        max: 500000,
        templates: [
          "{amount} baru mendarat! Dompet langsung tegap.",
          "Pendapatan {amount}? Aku siap gemukan tabungan.",
          "{amount} masuk, aku joget kecil tapi berkelas.",
        ],
      },
      {
        max: Infinity,
        templates: [
          "Wuih {amount}! Gelar karpet merah buat dompet.",
          "Income segede {amount}? Aku mendadak sultan dadakan.",
          "{amount} masuk, ayo toast dengan air putih dulu!",
        ],
      },
    ],
    transfer: [
      {
        max: 100000,
        templates: [
          "Muter-muter {amount}, aku lagi jalan santai.",
          "Transfer {amount}? Aku cuma pindah kursi.",
          "{amount} pindah rekening, nggak pakai drama.",
        ],
      },
      {
        max: 500000,
        templates: [
          "{amount} lagi pindah rumah. Aku bawain kardus.",
          "Transfer {amount}? Dompet siap jadi tour guide.",
          "Mengantar {amount} ke alamat baru, perjalanan seru nih.",
        ],
      },
      {
        max: Infinity,
        templates: [
          "Whoa {amount} pindah! Butuh truk sama satpam virtual.",
          "Transfer jumbo {amount}. Aku minta kipas darurat.",
          "{amount} cabut bareng koper gede. Dompet butuh teh manis.",
        ],
      },
    ],
  },
  en: {
    expense: [
      {
        max: 50000,
        templates: [
          "Only {amount}? Wallet still doing light stretches.",
          "A {category} treat for {amount}. I'm giggling, not screaming.",
          "Spending {amount} feels like feeding me snacks.",
        ],
      },
      {
        max: 200000,
        templates: [
          "Okay, {amount} for {category}. Wallet just booked a yoga class.",
          "{amount} flew away. Please tell me {category} was worth it!",
          "I'm sweating a bit from that {category} bill.",
        ],
      },
      {
        max: Infinity,
        templates: [
          "Whoa, {amount}! My wallet just screamed into a pillow.",
          "{amount} on {category}? I'm filing for dramatic flair.",
          "That transfer of {amount} made my zipper faint.",
        ],
      },
    ],
    income: [
      {
        max: 100000,
        templates: [
          "Yay, {amount} arrived! Tiny but mighty.",
          "Balance got {amount} richer. Happy wiggle engaged.",
          "{amount} in income—I'll treat myself to a humble brag.",
        ],
      },
      {
        max: 500000,
        templates: [
          "{amount} incoming! Wallet flexes politely.",
          "Hello {amount}! Let's puff up those savings.",
          "Deposit of {amount}? I'm doing the cha-cha.",
        ],
      },
      {
        max: Infinity,
        templates: [
          "{amount} landed! Roll out the golden carpet.",
          "Income that big ({amount})? I'm declaring a mini-festival.",
          "Boom! {amount} just moved in. I'm royalty now.",
        ],
      },
    ],
    transfer: [
      {
        max: 100000,
        templates: [
          "Shuffling {amount} around—just a casual jog.",
          "Tiny transfer of {amount}. I barely packed a suitcase.",
          "{amount} relocating? I'll send a postcard.",
        ],
      },
      {
        max: 500000,
        templates: [
          "{amount} is changing addresses. Hope it writes!",
          "Moving {amount}? My wallet brought snacks for the trip.",
          "Transfer mission: {amount}. Success with mild drama.",
        ],
      },
      {
        max: Infinity,
        templates: [
          "{amount} moved out in one go! Call the moving trucks.",
          "That {amount} transfer needed a parade escort.",
          "Huge relocation of {amount}! Wallet needs a nap.",
        ],
      },
    ],
  },
};

const defaultTypeLabel = {
  id: {
    expense: "pengeluaran",
    income: "pendapatan",
    transfer: "transfer",
  },
  en: {
    expense: "expense",
    income: "income",
    transfer: "transfer",
  },
};

function formatAmountByLang(amount, lang) {
  const value = Number.isFinite(amount) ? Math.abs(amount) : 0;
  try {
    const formatter = new Intl.NumberFormat(lang === "en" ? "en-US" : "id-ID", {
      style: "currency",
      currency: "IDR",
      maximumFractionDigits: 0,
    });
    return formatter.format(value);
  } catch {
    return `${lang === "en" ? "IDR" : "Rp"} ${value.toLocaleString("en-US")}`;
  }
}

function fillTemplate(template, values) {
  if (!template) return "";
  return template.replace(/\{(\w+)\}/g, (match, key) => {
    return Object.prototype.hasOwnProperty.call(values, key)
      ? values[key]
      : match;
  });
}

export function buildDynamicMoneyTalk({
  lang = "id",
  amount = 0,
  type = "expense",
  category,
} = {}) {
  const normalizedLang = dynamicTemplates[lang] ? lang : "id";
  const normalizedType = dynamicTemplates[normalizedLang][type]
    ? type
    : "expense";
  const templates = dynamicTemplates[normalizedLang][normalizedType];
  if (!templates || !templates.length) return "";
  const value = Number.isFinite(Number(amount)) ? Math.abs(Number(amount)) : 0;
  const bucket =
    templates.find((entry) => value <= entry.max) ||
    templates[templates.length - 1];
  if (!bucket || !bucket.templates.length) return "";
  const label = (category && String(category).trim())
    ? String(category).trim()
    : defaultTypeLabel[normalizedLang][normalizedType];
  const template = bucket.templates[Math.floor(Math.random() * bucket.templates.length)];
  const formattedAmount = formatAmountByLang(value, normalizedLang);
  return fillTemplate(template, {
    amount: formattedAmount,
    category: label,
  });
}

