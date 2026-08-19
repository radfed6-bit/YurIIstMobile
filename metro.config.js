const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

// legal.db (SQLite-база кодексов, ~62 МБ) бандлится как бинарный ассет,
// а не как исходный файл — иначе Metro попытается его распарсить.
config.resolver.assetExts.push("db");

module.exports = config;
