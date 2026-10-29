/* Traduzioni tipologie e prodotti agricoli (condiviso frontend + backend) */
(function (root) {
    const PRODUCT_TYPES = {
        frutta:  { it: 'Frutta',   en: 'Fruit',      es: 'Fruta' },
        verdura: { it: 'Verdura',  en: 'Vegetables', es: 'Verduras' },
        cereali: { it: 'Cereali',  en: 'Cereals',    es: 'Cereales' },
        vino:    { it: 'Vino',     en: 'Wine',       es: 'Vino' },
        olio:    { it: 'Olio',     en: 'Oil',        es: 'Aceite' },
        latte:   { it: 'Latte',    en: 'Milk',       es: 'Leche' },
        carne:   { it: 'Carne',    en: 'Meat',       es: 'Carne' },
        olivo:   { it: 'Olivo',    en: 'Olive',      es: 'Olivo' },
        vite:    { it: 'Vite',     en: 'Vine',       es: 'Vid' }
    };

    const PRODUCTS = {
        'Albicocche': { en: 'Apricots', es: 'Albaricoques' },
        'Ananas': { en: 'Pineapple', es: 'Piña' },
        'Arance': { en: 'Oranges', es: 'Naranjas' },
        'Avocado': { en: 'Avocado', es: 'Aguacate' },
        'Banane': { en: 'Bananas', es: 'Plátanos' },
        'Ciliegie': { en: 'Cherries', es: 'Cerezas' },
        'Fragole': { en: 'Strawberries', es: 'Fresas' },
        'Kiwi': { en: 'Kiwi', es: 'Kiwi' },
        'Limoni': { en: 'Lemons', es: 'Limones' },
        'Mandarini': { en: 'Mandarins', es: 'Mandarinas' },
        'Mango': { en: 'Mango', es: 'Mango' },
        'Mele': { en: 'Apples', es: 'Manzanas' },
        'Pesche': { en: 'Peaches', es: 'Melocotones' },
        'Uva da tavola': { en: 'Table grapes', es: 'Uva de mesa' },
        'Angurie': { en: 'Watermelons', es: 'Sandías' },
        'Asparagi': { en: 'Asparagus', es: 'Espárragos' },
        'Broccoli': { en: 'Broccoli', es: 'Brócoli' },
        'Carota': { en: 'Carrot', es: 'Zanahoria' },
        'Carote': { en: 'Carrots', es: 'Zanahorias' },
        'Cavolfiori': { en: 'Cauliflowers', es: 'Coliflores' },
        'Cetriolo': { en: 'Cucumber', es: 'Pepino' },
        'Cipolla': { en: 'Onion', es: 'Cebolla' },
        'Fagiolini e legumi freschi': { en: 'Green beans and fresh legumes', es: 'Judías verdes y legumbres frescas' },
        'Lattuga e insalate da foglia': { en: 'Lettuce and leafy salads', es: 'Lechuga y ensaladas de hoja' },
        'Melone': { en: 'Melon', es: 'Melón' },
        'Patata': { en: 'Potato', es: 'Patata' },
        'Peperone': { en: 'Pepper', es: 'Pimiento' },
        'Pomodoro': { en: 'Tomato', es: 'Tomate' },
        'Zucchine': { en: 'Zucchini', es: 'Calabacines' },
        'Avena': { en: 'Oats', es: 'Avena' },
        'Grano': { en: 'Wheat', es: 'Trigo' },
        'Mais': { en: 'Maize', es: 'Maíz' },
        'Orzo': { en: 'Barley', es: 'Cebada' },
        'Riso': { en: 'Rice', es: 'Arroz' },
        'Segale': { en: 'Rye', es: 'Centeno' },
        'Sorgo': { en: 'Sorghum', es: 'Sorgo' },
        'altri': { it: 'Altri (specifica)', en: 'Other (specify)', es: 'Otros (especificar)' }
    };

    const PRODUCT_KEYS = Object.keys(PRODUCTS).reduce((acc, k) => { acc[k.toLowerCase()] = k; return acc; }, {});

    function trProductType(value, lang) {
        if (!value) return value || '';
        const entry = PRODUCT_TYPES[String(value).trim().toLowerCase()];
        return entry ? (entry[lang] || entry.it) : value;
    }

    function trProduct(value, lang) {
        if (!value) return value || '';
        const key = PRODUCT_KEYS[String(value).trim().toLowerCase()];
        if (!key) return value;
        return PRODUCTS[key][lang] || PRODUCTS[key].it || key;
    }

    const api = { PRODUCT_TYPES, PRODUCTS, trProductType, trProduct };
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    else Object.assign(root, api);
})(typeof window !== 'undefined' ? window : this);
