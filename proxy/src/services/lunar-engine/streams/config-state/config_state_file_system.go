package configstate

import (
	"errors"
	"io"
	"lunar/engine/utils/environment"
	"os"
	"path/filepath"
	"sort"
	"strconv"
	"strings"
	"syscall"
	"time"

	"github.com/rs/zerolog/log"
)

const configBackupPrefix = "lunar-proxy-"

// cleanAll removes all files and folders inside config root (but not the root itself).
func cleanAll(exclude ...string) error {
	configRoot := environment.GetConfigRootDirectory()
	entries, err := os.ReadDir(configRoot)
	if err != nil {
		log.Error().Err(err).Msgf("Failed to read config root: %s", configRoot)
		return err
	}
	excludeMap := make(map[string]struct{}, len(exclude))
	for _, ex := range exclude {
		excludeMap[ex] = struct{}{}
	}
	for _, entry := range entries {
		if _, skip := excludeMap[entry.Name()]; skip {
			continue
		}
		path := filepath.Join(configRoot, entry.Name())
		err := os.RemoveAll(path)
		if err != nil {
			log.Error().Err(err).Msgf("Failed to remove: %s", path)
			return err
		}
	}
	return nil
}

// listBackupFolders returns sorted list of backup folder names (desc by timestamp)
func listBackupFolders(backupDir string) ([]string, error) {
	entries, err := os.ReadDir(backupDir)
	if err != nil {
		log.Error().Err(err).Msgf("Failed to read backup dir: %s", backupDir)
		return nil, err
	}
	var backups []string
	for _, entry := range entries {
		if entry.IsDir() && strings.HasPrefix(entry.Name(), configBackupPrefix) {
			// Ensure the suffix is a valid timestamp
			suffix := strings.TrimPrefix(entry.Name(), configBackupPrefix)
			if _, err := strconv.ParseInt(suffix, 10, 64); err == nil {
				backups = append(backups, entry.Name())
			}
		}
	}
	// Sort by timestamp descending
	sort.Slice(backups, func(i, j int) bool {
		ti, _ := strconv.ParseInt(strings.TrimPrefix(backups[i], configBackupPrefix), 10, 64)
		tj, _ := strconv.ParseInt(strings.TrimPrefix(backups[j], configBackupPrefix), 10, 64)
		return ti > tj
	})
	return backups, nil
}

// pruneBackups removes oldest backup folders if count exceeds max.
func pruneBackups(backupDir string, maxBackups int) error {
	backups, err := listBackupFolders(backupDir)
	if err != nil {
		return err
	}
	if len(backups) <= maxBackups {
		return nil
	}
	toRemove := backups[maxBackups:]
	for _, b := range toRemove {
		fullPath := filepath.Join(backupDir, b)
		err := os.RemoveAll(fullPath)
		if err != nil {
			log.Error().Err(err).Msgf("Failed to remove old backup: %s", fullPath)
			return err
		}
		log.Trace().Msgf("Removed old backup: %s", fullPath)
	}
	return nil
}

// createBackupFolder creates a backup folder with the given timestamp.
func backupConfig() error {
	configRoot := environment.GetConfigRootDirectory()
	if configRoot == "" {
		log.Error().Msg("Config root dir not set")
		return errors.New("config root dir not set")
	}

	backupDir := environment.GetConfigBackupDirectory()
	maxBackups := environment.GetConfigMaxBackups()

	// Make sure backup dir exists
	if err := os.MkdirAll(backupDir, 0o755); err != nil {
		log.Error().Err(err).Msgf("Failed to create backup dir: %s", backupDir)
		return err
	}

	backupFolderPath := filepath.Join(backupDir, getBackupFolderName())

	// Copy config dir to backup location
	log.Debug().Msgf("Backing up config from %s to %s", configRoot, backupFolderPath)
	if err := copyDir(configRoot, backupFolderPath); err != nil {
		return err
	}
	log.Debug().Msgf("Backup complete: %s", backupFolderPath)

	return pruneBackups(backupDir, maxBackups)
}

// restoreConfigNewest restores config from the newest backup.
func restoreConfigNewest() error {
	backupDir := environment.GetConfigBackupDirectory()
	backups, err := listBackupFolders(backupDir)
	if err != nil {
		return err
	}
	if len(backups) == 0 {
		log.Error().Msg("No backups available to restore")
		return errors.New("no backups available")
	}
	return restoreConfigFromBackupFolder(backups[0])
}

// restoreConfigFromTimestamp restores config from a backup with the given timestamp.
func restoreConfigFromTimestamp(timestamp string) error {
	backupDir := environment.GetConfigBackupDirectory()
	backupFolder := configBackupPrefix + timestamp
	fullPath := filepath.Join(backupDir, backupFolder)
	info, err := os.Stat(fullPath)
	if err != nil {
		log.Error().Err(err).Msgf("Backup folder %s not found", fullPath)
		return err
	}
	if !info.IsDir() {
		log.Error().Msgf("Backup folder %s is not a directory", fullPath)
		return errors.New("backup folder is not a directory")
	}
	return restoreConfigFromBackupFolder(backupFolder)
}

// restoreConfigFromBackupFolder restores config from a specific backup folder.
// It moves the current config out of the way and restores from the backup.
// If the restore fails, it attempts to restore the original config from a rollback copy.
// If the rollback fails, it returns an error.
// If the restore is successful, it removes the rollback copy.
// The rollback copy is named "lunar-proxy-rollback-<timestamp>"
// and is created in the same parent directory as the config root.
func restoreConfigFromBackupFolder(backupFolder string) error {
	backupDir := environment.GetConfigBackupDirectory()
	configRoot := environment.GetConfigRootDirectory()
	backupPath := filepath.Join(backupDir, backupFolder)

	rollbackDirName := ".rollback-" + strconv.FormatInt(time.Now().Unix(), 10)
	rollbackPath := filepath.Join(configRoot, rollbackDirName)

	// Step 1: Copy current config to rollback path (for rollback in case of failure)
	if err := copyDir(configRoot, rollbackPath); err != nil {
		log.Error().Err(err).Msg("Failed to copy current config for rollback protection")
		return err
	}

	// Step 2: Remove all contents inside configRoot (but not the folder itself)
	if err := cleanAll(rollbackDirName); err != nil {
		log.Error().Err(err).Msg("Failed to clean config root before restore")
		return err
	}

	// Step 3: Try to copy backup contents to configRoot
	log.Debug().Msgf("Restoring config from %s to %s", backupPath, configRoot)
	if err := copyDir(backupPath, configRoot); err != nil {
		log.Error().Err(err).Msg("Failed to restore config from backup, rolling back")
		// Cleanup failed restore
		_ = cleanAll(rollbackDirName)
		// Restore from rollback
		if restoreErr := copyDir(rollbackPath, configRoot); restoreErr != nil {
			log.Error().Err(restoreErr).Msg("Failed to restore config from rollback")
			return err
		}
		_ = os.RemoveAll(rollbackPath) // cleanup rollback
		return err
	}

	_ = os.RemoveAll(rollbackPath) // cleanup rollback

	log.Debug().Msg("Config successfully restored from backup")
	return nil
}

// getBackupFolderName returns folder name in format "lunar-proxy-<timestamp>"
func getBackupFolderName() string {
	time.Sleep(time.Second * 1) // Ensure unique timestamp for tests
	timestamp := strconv.FormatInt(time.Now().Unix(), 10)
	backupFolderName := configBackupPrefix + timestamp

	return backupFolderName
}

// copyDir copies a directory recursively from src to dst.
func copyDir(src string, dst string) error {
	return filepath.Walk(src, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			if os.IsNotExist(err) {
				return nil
			}
			log.Error().Err(err).Msgf("Error walking path %s", path)
			return err
		}

		relPath, err := filepath.Rel(src, path)
		if err != nil {
			log.Error().Err(err).Msgf("Error getting relative path from %s to %s", src, path)
			return err
		}
		targetPath := filepath.Join(dst, relPath)

		if info.IsDir() {
			if err := os.MkdirAll(targetPath, info.Mode()); err != nil {
				log.Error().Err(err).Msgf("Failed to create directory %s", targetPath)
				return err
			}
			if stat, ok := info.Sys().(*syscall.Stat_t); ok {
				_ = os.Chown(targetPath, int(stat.Uid), int(stat.Gid))
			}
		} else if info.Mode().IsRegular() {
			srcFile, err := os.Open(path)
			if err != nil {
				if os.IsNotExist(err) {
					log.Warn().Msgf("Skipping missing file during copy: %s", path)
					return nil
				}
				log.Error().Err(err).Msgf("Failed to open source file %s", path)
				return err
			}
			defer srcFile.Close()

			dstFile, err := os.OpenFile(targetPath, os.O_CREATE|os.O_WRONLY|os.O_TRUNC, info.Mode())
			if err != nil {
				log.Error().Err(err).Msgf("Failed to create dest file %s", targetPath)
				return err
			}

			if _, err := io.Copy(dstFile, srcFile); err != nil {
				log.Error().Err(err).Msgf("Failed to copy file %s to %s", path, targetPath)
				dstFile.Close()
				return err
			}
			dstFile.Close()

			if stat, ok := info.Sys().(*syscall.Stat_t); ok {
				_ = os.Chown(targetPath, int(stat.Uid), int(stat.Gid))
			}
		}
		return nil
	})
}

func storeFileOnDisk(filePath string, content []byte) error {
	_ = cleanUpFile(filePath)

	dir := filepath.Dir(filePath)
	if err := os.MkdirAll(dir, os.ModePerm); err != nil {
		return err
	}

	file, err := os.Create(filePath)
	if err != nil {
		return err
	}
	defer file.Close()

	_, err = file.Write(content)
	return err
}

func readFileFromDisk(filePath string) ([]byte, error) {
	file, err := os.Open(filePath)
	if err != nil {
		return nil, err
	}
	defer file.Close()

	content, err := io.ReadAll(file)
	if err != nil {
		return nil, err
	}
	return content, nil
}

func cleanUpFile(filePath string) error {
	if err := os.Remove(filePath); err != nil && !os.IsNotExist(err) {
		return err
	}
	return nil
}

func cleanUpDirectory(cleanupPath string) error {
	err := filepath.Walk(cleanupPath, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}
		if !info.IsDir() {
			return os.Remove(path)
		}
		return nil
	})
	return err
}
