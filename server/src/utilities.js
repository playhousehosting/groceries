const uomContent = [
    {_id: "system:uom:EA", type: "uom", name: "EA", description: "Each", pluralDescription: "Eaches"},
    {_id: "system:uom:X2", type: "uom", name: "X2", description: "Bunch", pluralDescription: "Bunches"},
    {_id: "system:uom:OZ", type: "uom", name: "OZ", description: "Ounce", pluralDescription: "Ounces"},
    {_id: "system:uom:FO", type: "uom", name: "FO", description: "Fluid Ounce", pluralDescription: "Fluid Ounces"},
    {_id: "system:uom:LB", type: "uom", name: "LB", description: "Pound", pluralDescription: "Pounds"},
    {_id: "system:uom:GA", type: "uom", name: "GA", description: "Gallon", pluralDescription: "Gallons"},
    {_id: "system:uom:GH", type: "uom", name: "GH", description: "Half Gallon", pluralDescription: "Half Gallons"},
    {_id: "system:uom:QT", type: "uom", name: "QT", description: "Quart", pluralDescription: "Quarts"},
    {_id: "system:uom:LT", type: "uom", name: "LT", description: "Liter", pluralDescription: "Liters"},
    {_id: "system:uom:ML", type: "uom", name: "ML", description: "Milliliter", pluralDescription: "Milliliters"},
    {_id: "system:uom:KG", type: "uom", name: "KG", description: "Kilogram", pluralDescription: "Kilograms"},
    {_id: "system:uom:GR", type: "uom", name: "GR", description: "Gram", pluralDescription: "Grams"},
    {_id: "system:uom:BX", type: "uom", name: "BX", description: "Box", pluralDescription: "Boxes"},
    {_id: "system:uom:BG", type: "uom", name: "BG", description: "Bag", pluralDescription: "Bags"},
    {_id: "system:uom:BO", type: "uom", name: "BO", description: "Bottle", pluralDescription: "Bottles"},
    {_id: "system:uom:CA", type: "uom", name: "CA", description: "Case", pluralDescription: "Cases"},
    {_id: "system:uom:CN", type: "uom", name: "CN", description: "Can", pluralDescription: "Cans"},
    {_id: "system:uom:CU", type: "uom", name: "CU", description: "Cup", pluralDescription: "Cups"},
    {_id: "system:uom:CT", type: "uom", name: "CT", description: "Carton", pluralDescription: "Cartons"},
    {_id: "system:uom:CH", type: "uom", name: "CH", description: "Container", pluralDescription: "Containers"},
    {_id: "system:uom:DZ", type: "uom", name: "DZ", description: "Dozen", pluralDescription: "Dozen"},
    {_id: "system:uom:JR", type: "uom", name: "JR", description: "Jar", pluralDescription: "Jars"},
    {_id: "system:uom:X8", type: "uom", name: "X8", description: "Loaf", pluralDescription: "Loaves"},
    {_id: "system:uom:Y1", type: "uom", name: "Y1", description: "Slice", pluralDescription: "Slices"},
    {_id: "system:uom:15", type: "uom", name: "15", description: "Stick", pluralDescription: "Sticks"},
    {_id: "system:uom:PC", type: "uom", name: "PC", description: "Piece", pluralDescription: "Pieces"},
    {_id: "system:uom:PK", type: "uom", name: "PK", description: "Package", pluralDescription: "Packages"},
    {_id: "system:uom:PT", type: "uom", name: "PT", description: "Pint", pluralDescription: "Pints"},
    {_id: "system:uom:RL", type: "uom", name: "RL", description: "Roll", pluralDescription: "Rolls"},
]

const globalItems = require("../data/globalItems.json");

const categories = require("../data/categories.json");

function emailPatternValidation(email) {
    const emailRegex=/^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/
    return emailRegex.test(email);
};

function usernamePatternValidation(username) {
    const usernameRegex=/^[a-zA-Z0-9]*$/
    return usernameRegex.test(username);
}

function fullnamePatternValidation(fullname) {
    const usernameRegex=/^[a-zA-Z0-9 ]*$/
    return usernameRegex.test(fullname);
}

module.exports = {
    emailPatternValidation,
    usernamePatternValidation,
    fullnamePatternValidation,
    uomContent,
    globalItems,
    categories
}