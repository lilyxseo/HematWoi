export const QUOTES = [
  {
    id: 1,
    category: "motivasi",
    text: {
      id: "Simpan dulu, belanja kemudian.",
      en: "Save first, spend later.",
    },
  },
  {
    id: 2,
    category: "motivasi",
    text: {
      id: "Sedikit demi sedikit, lama-lama jadi bukit.",
      en: "Little by little, savings grow big.",
    },
  },
  {
    id: 3,
    category: "motivasi",
    text: {
      id: "Uang yang disimpan adalah keamanan esok.",
      en: "Money saved is tomorrow's security.",
    },
  },
  {
    id: 4,
    category: "motivasi",
    text: {
      id: "Anggaran itu menuntun uang, bukan uang menuntun kita.",
      en: "A budget tells your money where to go.",
    },
  },
  {
    id: 5,
    category: "motivasi",
    text: {
      id: "Potong satu pengeluaran, maju selangkah lebih bebas.",
      en: "Cut one expense, gain one step toward freedom.",
    },
  },
  {
    id: 6,
    category: "motivasi",
    text: {
      id: "Waktu terbaik menabung adalah kemarin, kedua adalah hari ini.",
      en: "The best time to save was yesterday, the second best is today.",
    },
  },
  {
    id: 7,
    category: "motivasi",
    text: {
      id: "Kebebasan finansial dimulai dari satu koin.",
      en: "Financial freedom starts with a single coin.",
    },
  },
  {
    id: 8,
    category: "motivasi",
    text: {
      id: "Disiplin menjembatani mimpi dan tabungan.",
      en: "Discipline bridges dreams and savings.",
    },
  },
  {
    id: 9,
    category: "motivasi",
    text: {
      id: "Dompetmu adalah masa depanmu, jagalah.",
      en: "Your wallet is your future—protect it.",
    },
  },
  {
    id: 10,
    category: "motivasi",
    text: {
      id: "Investasikan pada tujuan, bukan keinginan sesaat.",
      en: "Invest in your goals, not impulse buys.",
    },
  },
  {
    id: 11,
    category: "humor",
    text: {
      id: "Dompetku seperti bawang, dibuka bikin nangis.",
      en: "My wallet is like an onion; opening it makes me cry.",
    },
  },
  {
    id: 12,
    category: "humor",
    text: {
      id: "Menabung? Kukira tadi bilang 'menabung meme'.",
      en: "Saving money? I thought you said saving memes.",
    },
  },
  {
    id: 13,
    category: "humor",
    text: {
      id: "Cukup uang untuk seumur hidup—asal tidak dipakai.",
      en: "I have enough money to last my life, unless I spend it.",
    },
  },
  {
    id: 14,
    category: "humor",
    text: {
      id: "Aku jago menabung, sampai lupa di mana naruhnya.",
      en: "I'm great at saving; I just forget where I put it.",
    },
  },
  {
    id: 15,
    category: "humor",
    text: {
      id: "Kenapa bayar full kalau bisa tawar dengan rasa lapar.",
      en: "Why pay full price when you can bargain with hunger.",
    },
  },
  {
    id: 16,
    category: "humor",
    text: {
      id: "Anggaran? Aku sebut saja tebak-tebakan nekat.",
      en: "Budget? I call it reckless guessing.",
    },
  },
  {
    id: 17,
    category: "humor",
    text: {
      id: "Uang berbicara, tapi milikku selalu pamit.",
      en: "Money talks, but mine always says goodbye.",
    },
  },
  {
    id: 18,
    category: "humor",
    text: {
      id: "Rekeningku dan aku sedang diet.",
      en: "My bank account and I are on a diet.",
    },
  },
  {
    id: 19,
    category: "humor",
    text: {
      id: "Aku akan lebih hemat kalau kopi tidak ada.",
      en: "I'd save more if coffee didn't exist.",
    },
  },
  {
    id: 20,
    category: "humor",
    text: {
      id: "Siapa butuh penasihat keuangan kalau ada kupon.",
      en: "Who needs a financial advisor when you have coupons.",
    },
  },
  {
    id: 21,
    category: "tips",
    text: {
      id: "Bawa botol minum sendiri.",
      en: "Bring your own water bottle.",
    },
  },
  {
    id: 22,
    category: "tips",
    text: {
      id: "Masak di rumah tiga kali seminggu.",
      en: "Cook at home three times a week.",
    },
  },
  {
    id: 23,
    category: "tips",
    text: {
      id: "Catat setiap pengeluaran selama seminggu.",
      en: "Track every expense for a week.",
    },
  },
  {
    id: 24,
    category: "tips",
    text: {
      id: "Berhenti langganan layanan yang tak dipakai.",
      en: "Unsubscribe from unused services.",
    },
  },
  {
    id: 25,
    category: "tips",
    text: {
      id: "Bandingkan harga sebelum membeli.",
      en: "Compare prices before buying.",
    },
  },
  {
    id: 26,
    category: "tips",
    text: {
      id: "Gunakan transportasi umum seminggu sekali.",
      en: "Use public transport once a week.",
    },
  },
  {
    id: 27,
    category: "tips",
    text: {
      id: "Atur transfer otomatis ke tabungan.",
      en: "Set automatic transfers to savings.",
    },
  },
  {
    id: 28,
    category: "tips",
    text: {
      id: "Tunda belanja dengan aturan 24 jam.",
      en: "Delay purchases with the 24-hour rule.",
    },
  },
  {
    id: 29,
    category: "tips",
    text: {
      id: "Perbaiki barang sebelum membeli baru.",
      en: "Repair items before replacing them.",
    },
  },
  {
    id: 30,
    category: "tips",
    text: {
      id: "Gunakan daftar belanja untuk hindari impuls.",
      en: "Use a shopping list to avoid impulse buys.",
    },
  },
];

export async function fetchQuotes() {
  // simulate small network latency
  return new Promise((resolve) => {
    setTimeout(() => resolve(QUOTES), 100);
  });
}
