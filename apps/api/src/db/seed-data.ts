/**
 * Catalog seed. Product photos come from Open Food Facts (ODbL) and are
 * re-encoded into our own storage on seed, so the app never hot-links them.
 */
export interface SeedCategory {
  slug: string;
  name: string;
  icon: string;
  color: string;
}

export interface SeedProduct {
  name: string;
  /** Stable identity for upserts when the display name changes (defaults to slugify(name)). */
  slug?: string;
  brand?: string;
  category: string;
  price: number; // BRL
  compareAt?: number;
  /** Members-only price (BRL); must be below `price`. */
  clubPrice?: number;
  unit?: "un" | "kg" | "g" | "l" | "ml" | "pct" | "cx";
  unitLabel: string;
  stock?: number;
  featured?: boolean;
  tags?: string[];
  description?: string;
  /** Open Food Facts image URL (or any public image). */
  image?: string;
}

export const SEED_CATEGORIES: SeedCategory[] = [
  { slug: "hortifruti", name: "Hortifruti", icon: "🥬", color: "#dff1dc" },
  { slug: "acougue", name: "Açougue & Ovos", icon: "🥩", color: "#f9dcd6" },
  { slug: "padaria", name: "Padaria", icon: "🥖", color: "#f6e7c9" },
  { slug: "laticinios", name: "Laticínios", icon: "🧀", color: "#fbf1cf" },
  { slug: "frios", name: "Frios", icon: "🥓", color: "#f6dfe4" },
  { slug: "mercearia", name: "Mercearia", icon: "🍚", color: "#ece5d5" },
  { slug: "cafe-matinais", name: "Café & Matinais", icon: "☕", color: "#e7d9cc" },
  { slug: "bebidas", name: "Bebidas", icon: "🥤", color: "#d9ebf5" },
  { slug: "snacks", name: "Doces & Snacks", icon: "🍫", color: "#efdcd1" },
  { slug: "congelados", name: "Congelados", icon: "🧊", color: "#dbeaf3" },
  { slug: "limpeza", name: "Limpeza", icon: "🧼", color: "#d8eef0" },
  { slug: "higiene", name: "Higiene", icon: "🧴", color: "#e5e0f2" },
];

import seedImages from "./seed-images.json" with { type: "json" };

const img = (group: keyof typeof seedImages, i: number) => (seedImages[group] as { img: string }[])[i]?.img;

export const SEED_PRODUCTS: SeedProduct[] = [
  // ---- Hortifruti (fotos: Wikimedia Commons, ver seed-images.json) -----
  { name: "Banana Prata", category: "hortifruti", price: 6.99, clubPrice: 5.49, unit: "kg", unitLabel: "kg", stock: 120, featured: true, tags: ["fruta", "banana"], image: img("hortifruti", 0), description: "Bananas prata selecionadas, no ponto ideal para consumo. Vendidas por quilo." },
  { name: "Maçã Gala", category: "hortifruti", price: 9.9, unit: "kg", unitLabel: "kg", stock: 90, tags: ["fruta", "maçã"], image: img("hortifruti", 1) },
  { name: "Laranja Pera", category: "hortifruti", price: 4.49, compareAt: 5.49, unit: "kg", unitLabel: "kg", stock: 150, tags: ["fruta", "laranja", "suco"], image: img("hortifruti", 2) },
  { name: "Limão Tahiti", category: "hortifruti", price: 5.99, unit: "kg", unitLabel: "kg", stock: 80, tags: ["fruta", "limão"], image: img("hortifruti", 3) },
  { name: "Tomate Italiano", category: "hortifruti", price: 8.49, unit: "kg", unitLabel: "kg", stock: 100, featured: true, tags: ["legume", "tomate"], image: img("hortifruti", 4) },
  { name: "Cebola Branca", category: "hortifruti", price: 4.99, unit: "kg", unitLabel: "kg", stock: 110, tags: ["legume", "cebola"], image: img("hortifruti", 5) },
  { name: "Batata Inglesa", category: "hortifruti", price: 5.49, unit: "kg", unitLabel: "kg", stock: 140, tags: ["legume", "batata"], image: img("hortifruti", 6) },
  { name: "Cenoura", category: "hortifruti", price: 4.29, unit: "kg", unitLabel: "kg", stock: 95, tags: ["legume", "cenoura"], image: img("hortifruti", 7) },
  { name: "Abacate", category: "hortifruti", price: 3.99, unitLabel: "unidade", stock: 60, tags: ["fruta", "abacate"], image: img("hortifruti", 8) },
  { name: "Morango", category: "hortifruti", price: 9.9, compareAt: 12.9, unitLabel: "bandeja 250 g", stock: 40, featured: true, tags: ["fruta", "morango"], image: img("hortifruti", 9) },
  { name: "Uva Verde sem Semente", category: "hortifruti", price: 12.9, unitLabel: "bandeja 500 g", stock: 35, tags: ["fruta", "uva"], image: img("hortifruti", 10) },
  { name: "Alface Americana", category: "hortifruti", price: 3.49, unitLabel: "unidade", stock: 70, tags: ["verdura", "alface", "salada"], image: img("hortifruti", 11) },
  { name: "Brócolis Ninja", category: "hortifruti", price: 6.49, unitLabel: "unidade", stock: 45, tags: ["verdura", "brócolis"], image: img("hortifruti", 12) },
  { name: "Abacaxi Pérola", category: "hortifruti", price: 7.99, unitLabel: "unidade", stock: 50, tags: ["fruta", "abacaxi"], image: img("hortifruti", 13) },
  { name: "Manga Palmer", category: "hortifruti", price: 6.99, unit: "kg", unitLabel: "kg", stock: 65, tags: ["fruta", "manga"], image: img("hortifruti", 14) },
  { name: "Alho Nacional", category: "hortifruti", price: 3.29, unitLabel: "cabeça", stock: 130, tags: ["tempero", "alho"], image: img("hortifruti", 15) },
  { name: "Pimentão Vermelho", slug: "pimentao-sortido", category: "hortifruti", price: 9.49, unit: "kg", unitLabel: "kg", stock: 55, tags: ["legume", "pimentão"], image: img("hortifruti", 16) },

  // ---- Açougue & ovos ---------------------------------------------------
  { name: "Ovos Brancos Grandes", category: "acougue", price: 12.9, compareAt: 14.9, unitLabel: "dúzia", stock: 90, featured: true, tags: ["ovos"], image: img("acougue", 0) },
  { name: "Peito de Frango sem Osso", category: "acougue", price: 19.9, clubPrice: 16.9, unit: "kg", unitLabel: "kg", stock: 70, tags: ["frango", "carne"], image: img("acougue", 1), description: "Filé de peito de frango resfriado, sem pele e sem osso. Ideal para grelhados e airfryer." },
  { name: "Carne Moída de Primeira", category: "acougue", price: 34.9, compareAt: 39.9, unit: "kg", unitLabel: "kg", stock: 50, featured: true, tags: ["carne", "bovina"], image: img("acougue", 2), description: "Patinho moído na hora, magro e sem nervos." },

  // ---- Café & matinais ------------------------------------------------
  { name: "Café Torrado e Moído Tradicional Melitta", brand: "Melitta", category: "cafe-matinais", price: 21.9, compareAt: 25.9, unitLabel: "500 g", featured: true, stock: 64, tags: ["café", "melitta"], image: img("cafe", 0), description: "Blend clássico de grãos selecionados com torra média, corpo equilibrado e aroma marcante. Ideal para o coador e para a prensa francesa." },
  { name: "Café Torrado e Moído Extraforte Melitta", brand: "Melitta", category: "cafe-matinais", price: 22.9, unitLabel: "500 g", stock: 48, tags: ["café"], image: img("cafe", 1) },
  { name: "Café Pilão Tradicional", brand: "Pilão", category: "cafe-matinais", price: 13.49, unitLabel: "250 g", stock: 90, tags: ["café"], image: img("cafe", 2) },
  { name: "Café 3 Corações Tradicional", brand: "3 Corações", category: "cafe-matinais", price: 22.49, compareAt: 24.9, unitLabel: "500 g", stock: 55, tags: ["café"], image: img("cafe", 3) },
  { name: "Café Gourmet Cerrado Mineiro 3 Corações", brand: "3 Corações", category: "cafe-matinais", price: 29.9, unitLabel: "250 g", stock: 22, featured: true, tags: ["café", "gourmet"], image: img("cafe", 4), description: "Grãos 100% arábica da região do Cerrado Mineiro, com notas de chocolate e caramelo." },
  { name: "Nescafé Original Extraforte Solúvel", brand: "Nescafé", category: "cafe-matinais", price: 12.9, unitLabel: "100 g", stock: 70, tags: ["café", "solúvel"], image: img("cafe", 5) },
  { name: "Cápsulas Illy Intenso Espresso", brand: "Illy", category: "cafe-matinais", price: 42.9, compareAt: 49.9, unitLabel: "10 cápsulas", stock: 18, tags: ["café", "cápsula"], image: img("cafe", 6) },
  { name: "Dolce Gusto Mochaccino Canela", brand: "Nescafé", category: "cafe-matinais", price: 34.9, clubPrice: 24.9, unitLabel: "10 cápsulas", stock: 25, tags: ["café", "cápsula"], image: img("cafe", 7) },
  { name: "Aveia em Flocos Finos Nestlé", brand: "Nestlé", category: "cafe-matinais", price: 6.99, clubPrice: 4.99, unitLabel: "170 g", stock: 80, tags: ["aveia", "cereal"], image: img("matinais", 0) },
  { name: "Cereal Matinal Sucrilhos Kellogg's", brand: "Kellogg's", category: "cafe-matinais", price: 16.9, compareAt: 19.9, unitLabel: "510 g", stock: 40, tags: ["cereal"], image: img("matinais", 1) },
  { name: "Granola Integral Cereais Maltados Jasmine", brand: "Jasmine", category: "cafe-matinais", price: 24.9, unitLabel: "850 g", stock: 30, tags: ["granola"], image: img("matinais", 2) },
  { name: "Granola Cacau Mãe Terra", brand: "Mãe Terra", category: "cafe-matinais", price: 14.9, unitLabel: "250 g", stock: 35, tags: ["granola", "cacau"], image: img("matinais", 3) },
  { name: "Achocolatado Toddy Original", brand: "Toddy", category: "cafe-matinais", price: 11.9, unitLabel: "750 g", stock: 60, tags: ["achocolatado"], image: img("matinais", 4) },
  { name: "Achocolatado Nescau", brand: "Nestlé", category: "cafe-matinais", price: 12.49, compareAt: 13.99, unitLabel: "670 g", stock: 75, featured: true, tags: ["achocolatado"], image: img("matinais", 5) },
  { name: "Nesquik Chocolate", brand: "Nestlé", category: "cafe-matinais", price: 10.9, unitLabel: "400 g", stock: 40, tags: ["achocolatado"], image: img("matinais", 6) },

  // ---- Laticínios -----------------------------------------------------
  { name: "Leite em Pó Integral Ninho", brand: "Nestlé", category: "laticinios", price: 26.9, compareAt: 29.9, unitLabel: "380 g", stock: 45, tags: ["leite"], image: img("laticinios", 0) },
  { name: "Leite Integral Piracanjuba", brand: "Piracanjuba", category: "laticinios", price: 5.49, clubPrice: 4.79, unitLabel: "1 L", stock: 200, featured: true, tags: ["leite"], image: img("laticinios", 1), description: "Leite UHT integral, fonte de cálcio e proteínas. Caixa com tampa." },
  { name: "Creme de Leite Piracanjuba", brand: "Piracanjuba", category: "laticinios", price: 3.29, unitLabel: "200 g", stock: 120, tags: ["creme de leite"], image: img("laticinios", 2) },
  { name: "Leite Condensado Moça", brand: "Nestlé", category: "laticinios", price: 7.49, unitLabel: "395 g", stock: 110, tags: ["leite condensado"], image: img("laticinios", 3) },
  { name: "Yakult Leite Fermentado", brand: "Yakult", category: "laticinios", price: 9.9, unitLabel: "6 × 80 g", stock: 50, tags: ["fermentado"], image: img("laticinios", 4) },
  { name: "Leite Zero Lactose Integral Itambé", brand: "Itambé", category: "laticinios", price: 6.29, unitLabel: "1 L", stock: 90, tags: ["leite", "sem lactose"], image: img("laticinios", 5) },
  { name: "Requeijão Cremoso Vigor", brand: "Vigor", category: "laticinios", price: 8.9, unitLabel: "200 g", stock: 65, tags: ["requeijão"], image: img("laticinios", 6) },
  { name: "Cream Cheese Light Philadelphia", brand: "Philadelphia", category: "laticinios", price: 12.9, unitLabel: "150 g", stock: 30, tags: ["cream cheese"], image: img("laticinios", 7) },
  { name: "Mussarela Fatiada Président", brand: "Président", category: "laticinios", price: 19.9, compareAt: 22.9, unitLabel: "300 g", stock: 40, tags: ["queijo"], image: img("laticinios", 8) },
  { name: "Polenguinho Original", brand: "Polenghi", category: "laticinios", price: 9.49, unitLabel: "8 un · 136 g", stock: 55, tags: ["queijo"], image: img("laticinios", 9) },
  { name: "Queijo Minas Frescal Camanducaia", brand: "Camanducaia", category: "laticinios", price: 24.9, unitLabel: "500 g", stock: 20, tags: ["queijo"], image: img("laticinios", 10) },
  { name: "Manteiga Aviação com Sal", brand: "Aviação", category: "laticinios", price: 14.9, unitLabel: "200 g", stock: 48, tags: ["manteiga"], image: img("laticinios", 11) },
  { name: "Manteiga Extra com Sal Président", brand: "Président", category: "laticinios", price: 16.9, unitLabel: "200 g", stock: 36, tags: ["manteiga"], image: img("laticinios", 12) },

  // ---- Mercearia ------------------------------------------------------
  { name: "Arroz Integral Camil", brand: "Camil", category: "mercearia", price: 7.99, clubPrice: 6.49, unitLabel: "1 kg", stock: 100, tags: ["arroz", "integral"], image: img("mercearia", 0) },
  { name: "Arroz Tio João 100 Grãos Nobres", brand: "Tio João", category: "mercearia", price: 8.49, compareAt: 9.49, unitLabel: "1 kg", stock: 140, featured: true, tags: ["arroz"], image: img("mercearia", 1) },
  { name: "Arroz Branco Tipo 1 Camil", brand: "Camil", category: "mercearia", price: 27.9, compareAt: 31.9, unitLabel: "5 kg", stock: 60, tags: ["arroz"], image: img("mercearia", 2) },
  { name: "Azeite Extra Virgem Andorinha", brand: "Andorinha", category: "mercearia", price: 39.9, compareAt: 46.9, unitLabel: "500 ml", stock: 42, featured: true, tags: ["azeite"], image: img("mercearia", 3), description: "Azeite português extra virgem com acidez máxima de 0,5%. Frutado, ideal para saladas e finalizações." },
  { name: "Azeite Extra Virgem Clássico Gallo", brand: "Gallo", category: "mercearia", price: 37.9, clubPrice: 31.9, unitLabel: "500 ml", stock: 38, tags: ["azeite"], image: img("mercearia", 4) },
  { name: "Óleo de Soja Liza", brand: "Liza", category: "mercearia", price: 7.29, unitLabel: "900 ml", stock: 150, tags: ["óleo"], image: img("mercearia", 5) },
  { name: "Farinha de Mandioca Yoki", brand: "Yoki", category: "mercearia", price: 6.49, unitLabel: "500 g", stock: 70, tags: ["farinha"], image: img("mercearia", 6) },
  { name: "Farinha de Trigo Tradicional Bunge", brand: "Bunge", category: "mercearia", price: 5.99, unitLabel: "1 kg", stock: 90, tags: ["farinha"], image: img("mercearia", 7) },
  { name: "Ketchup Tradicional Hellmann's", brand: "Hellmann's", category: "mercearia", price: 9.9, unitLabel: "380 g", stock: 60, tags: ["ketchup", "molho"], image: img("mercearia", 8) },
  { name: "Molho de Tomate Tradicional Pomarola", brand: "Pomarola", category: "mercearia", price: 3.49, unitLabel: "300 g", stock: 130, tags: ["molho"], image: img("mercearia", 9) },
  { name: "Spaghetti Integral Barilla", brand: "Barilla", category: "mercearia", price: 12.9, unitLabel: "500 g", stock: 45, tags: ["massa", "integral"], image: img("mercearia", 10) },
  { name: "Massa para Lasanha Barilla", brand: "Barilla", category: "mercearia", price: 14.9, unitLabel: "250 g", stock: 30, tags: ["massa"], image: img("mercearia", 11) },
  { name: "Macarrão Instantâneo Nissin Lámen Carne", brand: "Nissin", category: "mercearia", price: 2.49, unitLabel: "85 g", stock: 300, tags: ["miojo"], image: img("mercearia", 12) },
  { name: "Macarrão Parafuso com Ovos Barilla", brand: "Barilla", category: "mercearia", price: 9.9, unitLabel: "500 g", stock: 55, tags: ["massa"], image: img("mercearia", 13) },
  { name: "Cup Noodles Cheddar", brand: "Nissin", category: "mercearia", price: 5.49, unitLabel: "69 g", stock: 80, tags: ["miojo"], image: img("mercearia", 14) },
  { name: "Açúcar Refinado Caravelas", brand: "Caravelas", category: "mercearia", price: 4.79, unitLabel: "1 kg", stock: 120, tags: ["açúcar"], image: img("mercearia", 15) },
  { name: "Açúcar Demerara União", brand: "União", category: "mercearia", price: 8.9, unitLabel: "1 kg", stock: 60, tags: ["açúcar", "demerara"], image: img("mercearia", 16) },

  // ---- Doces & snacks -------------------------------------------------
  { name: "Chocolate ao Leite Alpino", brand: "Nestlé", category: "snacks", price: 7.99, unitLabel: "85 g", stock: 90, tags: ["chocolate"], image: img("snacks", 0) },
  { name: "Chocolate ao Leite Hershey's", brand: "Hershey's", category: "snacks", price: 6.99, unitLabel: "82 g", stock: 80, tags: ["chocolate"], image: img("snacks", 1) },
  { name: "Bis Xtra Oreo", brand: "Lacta", category: "snacks", price: 3.99, unitLabel: "45 g", stock: 150, tags: ["chocolate", "wafer"], image: img("snacks", 2) },
  { name: "Chocolate Aerado Suflair", brand: "Nestlé", category: "snacks", price: 6.49, compareAt: 7.49, unitLabel: "80 g", stock: 100, tags: ["chocolate"], image: img("snacks", 3) },
  { name: "Talento Avelãs", brand: "Garoto", category: "snacks", price: 6.99, unitLabel: "85 g", stock: 85, featured: true, tags: ["chocolate"], image: img("snacks", 4) },
  { name: "Chocolate Garoto Castanha de Caju", brand: "Garoto", category: "snacks", price: 5.99, unitLabel: "80 g", stock: 70, tags: ["chocolate"], image: img("snacks", 5) },
  { name: "Biscoito Club Social Original", brand: "Club Social", category: "snacks", price: 6.49, unitLabel: "144 g", stock: 95, tags: ["biscoito"], image: img("snacks", 6) },
  { name: "Biscoito Oreo Original", brand: "Oreo", category: "snacks", price: 3.49, unitLabel: "90 g", stock: 140, tags: ["biscoito"], image: img("snacks", 7) },
  { name: "Biscoito Recheado Bono Doce de Leite", brand: "Nestlé", category: "snacks", price: 2.99, unitLabel: "90 g", stock: 160, tags: ["biscoito"], image: img("snacks", 8) },
  { name: "Biscoito Trakinas Morango", brand: "Trakinas", category: "snacks", price: 3.29, unitLabel: "126 g", stock: 120, tags: ["biscoito"], image: img("snacks", 9) },
  { name: "Paçoquita Rolha", brand: "Santa Helena", category: "snacks", price: 11.9, unitLabel: "216 g", stock: 50, tags: ["paçoca"], image: img("snacks", 10) },
  { name: "Batata Pringles Original", brand: "Pringles", category: "snacks", price: 10.9, compareAt: 12.9, unitLabel: "104 g", stock: 60, tags: ["salgadinho"], image: img("snacks", 11) },
  { name: "Batata Palha Tradicional Yoki", brand: "Yoki", category: "snacks", price: 7.49, unitLabel: "105 g", stock: 75, tags: ["batata palha"], image: img("snacks", 12) },
  { name: "Batata Lay's Clássica", brand: "Lay's", category: "snacks", price: 8.99, unitLabel: "115 g", stock: 70, tags: ["salgadinho"], image: img("snacks", 13) },
  { name: "Ruffles Original", brand: "Elma Chips", category: "snacks", price: 9.49, unitLabel: "115 g", stock: 80, featured: true, tags: ["salgadinho"], image: img("snacks", 14) },

  // ---- Padaria --------------------------------------------------------
  { name: "Pão de Forma Panco Premium", brand: "Panco", category: "padaria", price: 8.49, unitLabel: "500 g", stock: 45, tags: ["pão"], image: img("padaria", 0) },
  { name: "Pão Fermentação Natural Bauducco", brand: "Bauducco", category: "padaria", price: 11.9, compareAt: 13.9, unitLabel: "390 g", stock: 35, featured: true, tags: ["pão"], image: img("padaria", 1) },
  { name: "Pão Integral Tradicional Wickbold", brand: "Wickbold", category: "padaria", price: 9.49, unitLabel: "400 g", stock: 40, tags: ["pão", "integral"], image: img("padaria", 2) },
  { name: "Bisnaguinhas Panco", brand: "Panco", category: "padaria", price: 6.99, unitLabel: "300 g", stock: 50, tags: ["pão"], image: img("padaria", 3) },
  { name: "Torrada Bauducco Tradicional", brand: "Bauducco", category: "padaria", price: 5.49, unitLabel: "142 g", stock: 60, tags: ["torrada"], image: img("padaria", 4) },
  { name: "Tortilha Rap10 Fit Integral", brand: "Rap10", category: "padaria", price: 10.9, unitLabel: "330 g", stock: 30, tags: ["tortilha"], image: img("padaria", 5) },
  { name: "Pão de Leite Seven Boys", brand: "Seven Boys", category: "padaria", price: 7.99, unitLabel: "450 g", stock: 40, tags: ["pão"], image: img("padaria", 6) },
  { name: "Bolinho Bauducco Duplo Chocolate", brand: "Bauducco", category: "padaria", price: 2.49, unitLabel: "40 g", stock: 120, tags: ["bolinho"], image: img("padaria", 7) },
  { name: "Mistura para Brownie Dr. Oetker", brand: "Dr. Oetker", category: "padaria", price: 13.9, unitLabel: "480 g", stock: 25, tags: ["mistura"], image: img("padaria", 8) },

  // ---- Frios ----------------------------------------------------------
  { name: "Salsicha Viena Perdigão", brand: "Perdigão", category: "frios", price: 9.9, unitLabel: "500 g", stock: 60, tags: ["salsicha"], image: img("frios", 0) },
  { name: "Linguiça Calabresa Aurora", brand: "Aurora", category: "frios", price: 14.9, compareAt: 16.9, unitLabel: "400 g", stock: 45, tags: ["linguiça"], image: img("frios", 1) },
  { name: "Linguiça Toscana com Queijo Coalho Perdigão", brand: "Perdigão", category: "frios", price: 22.9, unitLabel: "600 g", stock: 30, tags: ["linguiça", "churrasco"], image: img("frios", 2) },
  { name: "Salsicha Hot Dog Sadia", brand: "Sadia", category: "frios", price: 10.9, unitLabel: "500 g", stock: 70, tags: ["salsicha"], image: img("frios", 3) },
  { name: "Presunto Cozido Fatiado Perdigão", brand: "Perdigão", category: "frios", price: 8.99, unitLabel: "200 g", stock: 55, featured: true, tags: ["presunto"], image: img("frios", 4) },
  { name: "Presunto Cozido Sadia Soltíssimo", brand: "Sadia", category: "frios", price: 9.49, unitLabel: "200 g", stock: 50, tags: ["presunto"], image: img("frios", 5) },
  { name: "Mortadela Defumada Fatiada Perdigão", brand: "Perdigão", category: "frios", price: 6.99, unitLabel: "200 g", stock: 60, tags: ["mortadela"], image: img("frios", 6) },

  // ---- Congelados -----------------------------------------------------
  { name: "Sorvete Ovomaltine Kibon", brand: "Kibon", category: "congelados", price: 29.9, compareAt: 34.9, unitLabel: "800 ml", stock: 25, featured: true, tags: ["sorvete"], image: img("congelados", 0) },
  { name: "Futuro Burger Defumado", brand: "Fazenda Futuro", category: "congelados", price: 24.9, unitLabel: "230 g", stock: 20, tags: ["vegetal", "hambúrguer"], image: img("congelados", 1) },
  { name: "Pizza de Lombo com Catupiry Seara", brand: "Seara", category: "congelados", price: 19.9, unitLabel: "460 g", stock: 30, tags: ["pizza"], image: img("congelados", 2) },
  { name: "Batata Smiles McCain", brand: "McCain", category: "congelados", price: 14.9, unitLabel: "400 g", stock: 40, tags: ["batata"], image: img("congelados", 3) },
  { name: "Batata McCain Airfryer Extra Crocante", brand: "McCain", category: "congelados", price: 18.9, unitLabel: "600 g", stock: 35, tags: ["batata", "airfryer"], image: img("congelados", 4) },
  { name: "Filé de Peito de Frango Sadia", brand: "Sadia", category: "congelados", price: 22.9, unitLabel: "1 kg", stock: 45, tags: ["frango"], image: img("congelados", 5) },
  { name: "Sorvete Cremosíssimo Flocos Kibon", brand: "Kibon", category: "congelados", price: 27.9, unitLabel: "1,5 L", stock: 20, tags: ["sorvete"], image: img("congelados", 6) },
  { name: "Pão de Queijo Coquetel Ideal de Minas", brand: "Ideal de Minas", category: "congelados", price: 16.9, unitLabel: "800 g", stock: 30, tags: ["pão de queijo"], image: img("congelados", 7) },
  { name: "Camarão Grande Descascado Sadia", brand: "Sadia", category: "congelados", price: 49.9, compareAt: 56.9, unitLabel: "400 g", stock: 15, tags: ["camarão"], image: img("congelados", 8) },
  { name: "Ben & Jerry's Chocolate Fudge Brownie", brand: "Ben & Jerry's", category: "congelados", price: 44.9, unitLabel: "458 ml", stock: 12, tags: ["sorvete"], image: img("congelados", 9) },
  { name: "Sorvete Galak Nestlé", brand: "Nestlé", category: "congelados", price: 26.9, unitLabel: "1,5 L", stock: 18, tags: ["sorvete"], image: img("congelados", 10) },
  { name: "Häagen-Dazs Baunilha", brand: "Häagen-Dazs", category: "congelados", price: 54.9, unitLabel: "473 ml", stock: 10, tags: ["sorvete"], image: img("congelados", 11) },

  // ---- Bebidas --------------------------------------------------------
  { name: "Água Mineral Crystal sem Gás", brand: "Crystal", category: "bebidas", price: 1.99, unitLabel: "500 ml", stock: 400, tags: ["água"], image: img("bebidas", 0) },
  { name: "H2OH! Limão", brand: "Pepsi", category: "bebidas", price: 4.49, unitLabel: "500 ml", stock: 120, tags: ["água saborizada"], image: img("bebidas", 1) },
  { name: "San Pellegrino Aranciata", brand: "San Pellegrino", category: "bebidas", price: 8.9, unitLabel: "330 ml", stock: 40, tags: ["refrigerante"], image: img("bebidas", 2) },
  { name: "Água São Lourenço com Gás", brand: "São Lourenço", category: "bebidas", price: 3.49, unitLabel: "510 ml", stock: 150, tags: ["água", "gás"], image: img("bebidas", 3) },
  { name: "Coca-Cola Original", brand: "Coca-Cola", category: "bebidas", price: 9.99, compareAt: 11.49, unitLabel: "2 L", stock: 200, featured: true, tags: ["refrigerante"], image: img("bebidas", 4) },
  { name: "Guaraná Antarctica", brand: "Antarctica", category: "bebidas", price: 8.49, unitLabel: "2 L", stock: 180, tags: ["refrigerante"], image: img("bebidas", 5) },
  { name: "Coca-Cola Sem Açúcar Lata", brand: "Coca-Cola", category: "bebidas", price: 3.99, unitLabel: "310 ml", stock: 240, tags: ["refrigerante", "zero"], image: img("bebidas", 6) },
  { name: "Suco Integral Laranja Natural One", brand: "Natural One", category: "bebidas", price: 14.9, compareAt: 16.9, unitLabel: "900 ml", stock: 50, featured: true, tags: ["suco"], image: img("bebidas", 7) },
  { name: "Suco Integral Laranja Xandô", brand: "Xandô", category: "bebidas", price: 15.9, unitLabel: "900 ml", stock: 30, tags: ["suco"], image: img("bebidas", 8) },
  { name: "Suco Concentrado Caju Maguary", brand: "Maguary", category: "bebidas", price: 7.49, unitLabel: "500 ml", stock: 60, tags: ["suco"], image: img("bebidas", 9) },
  { name: "Cerveja Heineken Lata", brand: "Heineken", category: "bebidas", price: 5.49, unitLabel: "350 ml", stock: 300, tags: ["cerveja"], image: img("bebidas", 10) },
  { name: "Cerveja Stella Artois Long Neck", brand: "Stella Artois", category: "bebidas", price: 5.99, unitLabel: "275 ml", stock: 200, tags: ["cerveja"], image: img("bebidas", 11) },
  { name: "Cerveja Brahma Chopp Lata", brand: "Brahma", category: "bebidas", price: 3.79, unitLabel: "350 ml", stock: 320, tags: ["cerveja"], image: img("bebidas", 12) },
  { name: "Red Bull Energy Drink", brand: "Red Bull", category: "bebidas", price: 9.9, unitLabel: "250 ml", stock: 90, tags: ["energético"], image: img("bebidas", 13) },
  { name: "Monster Energy Ultra", brand: "Monster", category: "bebidas", price: 8.99, unitLabel: "473 ml", stock: 100, tags: ["energético"], image: img("bebidas", 14) },
  { name: "Gatorade Frutas Cítricas", brand: "Gatorade", category: "bebidas", price: 6.49, unitLabel: "500 ml", stock: 110, tags: ["isotônico"], image: img("bebidas", 15) },
  { name: "Vinho Reservado Sweet Rosé Concha y Toro", brand: "Concha y Toro", category: "bebidas", price: 39.9, compareAt: 44.9, unitLabel: "750 ml", stock: 24, tags: ["vinho"], image: img("bebidas", 16) },

  // ---- Higiene --------------------------------------------------------
  { name: "Creme Dental Colgate Máxima Proteção Anticáries", brand: "Colgate", category: "higiene", price: 6.99, unitLabel: "180 g", stock: 90, tags: ["creme dental"], image: img("higiene", 0) },
  { name: "Shampoo Head & Shoulders Anticaspa", brand: "Head & Shoulders", category: "higiene", price: 19.9, compareAt: 22.9, unitLabel: "200 ml", stock: 40, tags: ["shampoo"], image: img("higiene", 1) },
  { name: "Desodorante Nivea Pearl & Beauty", brand: "Nivea", category: "higiene", price: 14.9, unitLabel: "150 ml", stock: 50, tags: ["desodorante"], image: img("higiene", 2) },
  { name: "Desodorante Dove Coco e Jasmim", brand: "Dove", category: "higiene", price: 15.9, unitLabel: "150 ml", stock: 45, tags: ["desodorante"], image: img("higiene", 3) },
];
