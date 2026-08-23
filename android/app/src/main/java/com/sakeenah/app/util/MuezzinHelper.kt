package com.sakeenah.app.util

import android.content.Context
import android.net.Uri
import androidx.core.content.FileProvider
import java.io.File

/**
 * Owns the selected muezzin metadata and downloaded audio files.
 *
 * Each prayer has its own selection. Audio files stay in the app-private
 * files directory so Android can play them after the app process is gone.
 */
object MuezzinHelper {

    private const val PREFS_NAME = "muezzin_prefs"
    private const val KEY_SELECTED_MUEZZIN_ID_PREFIX = "selected_muezzin_id_"
    private const val KEY_MUEZZIN_FILE_NAME_PREFIX = "muezzin_file_name_"
    private const val MUEZZINS_DIR = "muezzins"
    private val SAFE_FILE_NAME = Regex("[A-Za-z0-9._-]{1,160}")

    fun saveSelectedMuezzin(context: Context, prayerKey: String, muezzinId: String, fileName: String) {
        require(prayerKey.isNotBlank()) { "Prayer key is required" }
        require(SAFE_FILE_NAME.matches(fileName)) { "Invalid muezzin file name" }
        context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            .edit()
            .putString(KEY_SELECTED_MUEZZIN_ID_PREFIX + prayerKey, muezzinId)
            .putString(KEY_MUEZZIN_FILE_NAME_PREFIX + prayerKey, fileName)
            .apply()
    }

    fun getSelectedMuezzinId(context: Context, prayerKey: String): String? {
        return context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            .getString(KEY_SELECTED_MUEZZIN_ID_PREFIX + prayerKey, null)
    }

    fun getSelectedMuezzinFileName(context: Context, prayerKey: String): String? {
        return context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            .getString(KEY_MUEZZIN_FILE_NAME_PREFIX + prayerKey, null)
            ?.takeIf { SAFE_FILE_NAME.matches(it) }
    }

    fun getSelectedMuezzinFile(context: Context, prayerKey: String): File? {
        val fileName = getSelectedMuezzinFileName(context, prayerKey) ?: return null
        return listOf(getMuezzinFile(context, fileName), getLegacyMuezzinFile(context, fileName))
            .firstOrNull { it.isFile && it.length() > 0L }
    }

    fun getSelectedMuezzinUri(context: Context, prayerKey: String): Uri? {
        val file = getSelectedMuezzinFile(context, prayerKey) ?: return null
        return FileProvider.getUriForFile(context, "${context.packageName}.fileprovider", file)
    }

    fun isMuezzinDownloaded(context: Context, fileName: String): Boolean {
        if (!SAFE_FILE_NAME.matches(fileName)) return false
        val file = getMuezzinFile(context, fileName)
        return file.isFile && file.length() > 0L
    }

    fun getMuezzinFile(context: Context, fileName: String): File {
        require(SAFE_FILE_NAME.matches(fileName)) { "Invalid muezzin file name" }
        val muezzinsDir = File(context.filesDir, MUEZZINS_DIR)
        if (!muezzinsDir.exists()) muezzinsDir.mkdirs()
        return File(muezzinsDir, fileName)
    }

    fun deleteMuezzinFile(context: Context, fileName: String): Boolean {
        if (!SAFE_FILE_NAME.matches(fileName)) return false
        val current = getMuezzinFile(context, fileName)
        val legacy = getLegacyMuezzinFile(context, fileName)
        val currentDeleted = !current.exists() || current.delete()
        val legacyDeleted = !legacy.exists() || legacy.delete()
        return currentDeleted && legacyDeleted
    }

    private fun getLegacyMuezzinFile(context: Context, fileName: String): File {
        return File(File(context.dataDir, MUEZZINS_DIR), fileName)
    }

    fun clearSelectedMuezzin(context: Context, prayerKey: String) {
        context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            .edit()
            .remove(KEY_SELECTED_MUEZZIN_ID_PREFIX + prayerKey)
            .remove(KEY_MUEZZIN_FILE_NAME_PREFIX + prayerKey)
            .apply()
    }
}
