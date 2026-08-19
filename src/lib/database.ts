import * as SQLite from "expo-sqlite";
import * as FileSystem from "expo-file-system";
import { Asset } from "expo-asset";

const DB_NAME = "legal.db";
// Минимальный ожидаемый размер файла — защита от копирования пустой
// заглушки, если что-то пошло не так при первом запуске.
const MIN_EXPECTED_BYTES = 10_000_000;

async function ensureDatabaseCopied(onStatus?: (status: string) => void): Promise<void> {
  const sqliteDir = `${FileSystem.documentDirectory}SQLite`;
  const dbFilePath = `${sqliteDir}/${DB_NAME}`;

  const info = await FileSystem.getInfoAsync(dbFilePath);
  if (info.exists && "size" in info && info.size > MIN_EXPECTED_BYTES) {
    return;
  }

  onStatus?.("Подготовка базы законодательства…");
  await FileSystem.makeDirectoryAsync(sqliteDir, { intermediates: true }).catch(() => {
    // директория уже может существовать — не страшно
  });

  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const asset = Asset.fromModule(require("../../assets/legal.db"));
  await asset.downloadAsync();
  if (!asset.localUri) {
    throw new Error("Файл базы данных не найден в сборке приложения (assets/legal.db)");
  }

  await FileSystem.copyAsync({ from: asset.localUri, to: dbFilePath });
}

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

export function getDb(onStatus?: (status: string) => void): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = (async () => {
      await ensureDatabaseCopied(onStatus);
      onStatus?.("Открываю базу…");
      return SQLite.openDatabaseAsync(DB_NAME);
    })();
  }
  return dbPromise;
}

/** Вызывается один раз при старте приложения, чтобы прогреть базу до первого вопроса. */
export async function initDatabase(onStatus?: (status: string) => void): Promise<void> {
  await getDb(onStatus);
}
