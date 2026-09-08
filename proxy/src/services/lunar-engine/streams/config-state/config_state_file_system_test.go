package configstate

import (
	"lunar/engine/utils/environment"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
)

func TestMain(m *testing.M) {
	// Add all relevant ENV vars here
	origConfigDir := environment.SetConfigRootDirectory("test_payload")
	origBackupDir := os.Getenv("LUNAR_PROXY_CONFIG_BACKUP_DIR")
	origMaxBackups := environment.SetConfigMaxBackups(2)

	code := m.Run()

	environment.SetConfigRootDirectory(origConfigDir)
	environment.SetConfigMaxBackups(origMaxBackups)
	os.Setenv("LUNAR_PROXY_CONFIG_BACKUP_DIR", origBackupDir)

	os.Exit(code)
}

func TestCopyDirBasic(t *testing.T) {
	src := "test_payload"
	dst, err := os.MkdirTemp("", configBackupPrefix+"copy-")
	require.NoError(t, err, "Failed to create temp dir")
	defer os.RemoveAll(dst)

	err = copyDir(src, dst)
	require.NoError(t, err, "copyDir failed")

	dirsEqual(t, src, dst)
}

func TestListBackupFolders(t *testing.T) {
	backupDir := t.TempDir()

	// Create backups with different timestamps
	now := time.Now().Unix()
	timestamps := []int64{now - 300, now - 200, now - 100, now}
	var created []string
	for _, ts := range timestamps {
		created = append(created, createBackupFolder(t, "test_payload", backupDir, ts))
	}
	// Add some noise
	require.NoError(t, os.Mkdir(filepath.Join(backupDir, "not-a-backup"), 0o755))

	backups, err := listBackupFolders(backupDir)
	require.NoError(t, err)
	require.Equal(t, len(created), len(backups), "Should only list backup folders")

	// Check that order is descending
	var last int64 = 1<<63 - 1
	for _, name := range backups {
		require.True(t, strings.HasPrefix(name, configBackupPrefix), "Backup name prefix")
		suffix := strings.TrimPrefix(name, configBackupPrefix)
		ts, err := strconv.ParseInt(suffix, 10, 64)
		require.NoError(t, err)
		require.True(t, ts <= last, "Backups not sorted descending")
		last = ts
	}
}

func TestPruneBackups(t *testing.T) {
	backupDir := t.TempDir()

	// Create 5 backups with different timestamps
	now := time.Now().Unix()
	timestamps := []int64{now - 400, now - 300, now - 200, now - 100, now}
	expected := []int64{now, now - 100, now - 200}
	for _, ts := range timestamps {
		createBackupFolder(t, "test_payload", backupDir, ts)
	}

	// Prune to 3 backups
	err := pruneBackups(backupDir, 3)
	require.NoError(t, err)

	backups, err := listBackupFolders(backupDir)
	require.NoError(t, err)
	require.Equal(t, 3, len(backups))

	// Only the 3 newest remain
	var backupTimestamps []int64
	for _, name := range backups {
		suffix := strings.TrimPrefix(name, configBackupPrefix)
		ts, err := strconv.ParseInt(suffix, 10, 64)
		require.NoError(t, err)
		backupTimestamps = append(backupTimestamps, ts)
	}

	require.Equal(t, backupTimestamps, expected, "Unexpected backup timestamps after pruning")
}

func TestBackupConfig_CreatesAndPrunesBackups(t *testing.T) {
	backupDir := t.TempDir()
	require.NoError(t, os.Setenv("LUNAR_PROXY_CONFIG_BACKUP_DIR", backupDir))

	// Do 3 backups (should prune to 2)
	for range 3 {
		time.Sleep(1 * time.Second) // Ensure unique timestamp
		err := backupConfig()
		require.NoError(t, err)
	}

	entries, err := os.ReadDir(backupDir)
	require.NoError(t, err)

	// Only 2 backup dirs should exist, all matching the prefix
	var backups []string
	for _, e := range entries {
		if e.IsDir() && len(e.Name()) > len(configBackupPrefix) &&
			e.Name()[:len(configBackupPrefix)] == configBackupPrefix {
			backups = append(backups, e.Name())
		}
	}
	require.Equal(t, 2, len(backups), "Should only keep max backups")

	// Check that each backup is a copy of the config
	for _, backup := range backups {
		dirsEqual(t, "test_payload", filepath.Join(backupDir, backup))
	}
}

func TestRestoreConfigNewest(t *testing.T) {
	// temp working config dir
	workingConfigDir := t.TempDir()
	require.NoError(t, copyDir("test_payload", workingConfigDir))

	origConfigDir := environment.SetConfigRootDirectory(workingConfigDir)
	defer func() { environment.SetConfigRootDirectory(origConfigDir) }()

	backupDir := t.TempDir()
	origBackupDir := environment.SetConfigBackupDirectory(backupDir)
	defer func() { environment.SetConfigBackupDirectory(origBackupDir) }()

	// Run backup (should create a backup from the pristine working config)
	require.NoError(t, backupConfig())

	// Modify working config (simulate corruption or accidental change)
	badFile := filepath.Join(workingConfigDir, "some_new.txt")
	require.NoError(t, os.WriteFile(badFile, []byte("bad stuff"), 0o644))
	require.NoError(t, os.Remove(filepath.Join(workingConfigDir, "gateway_config.yaml")))

	// Restore from newest backup
	require.NoError(t, restoreConfigNewest())

	// working config dir should match the backup content (i.e., should match pristine test_payload)
	backups, err := listBackupFolders(backupDir)
	require.NoError(t, err)
	require.NotEmpty(t, backups)
	newestBackup := filepath.Join(backupDir, backups[0])
	dirsEqual(t, newestBackup, workingConfigDir)
}

func TestRestoreConfigFromTimestamp(t *testing.T) {
	// Prepare a temp working config dir (copy test_payload)
	workingConfigDir := t.TempDir()
	require.NoError(t, copyDir("test_payload", workingConfigDir))

	origConfigDir := environment.SetConfigRootDirectory(workingConfigDir)
	defer func() { environment.SetConfigRootDirectory(origConfigDir) }()

	backupDir := t.TempDir()
	origBackupDir := environment.SetConfigBackupDirectory(backupDir)
	defer func() { environment.SetConfigBackupDirectory(origBackupDir) }()

	// Create two backups with different content/timestamps (simulate backup history)
	ts1 := time.Now().Unix() - 100
	ts2 := time.Now().Unix()
	b1 := createBackupFolder(t, "test_payload", backupDir, ts1)
	_ = createBackupFolder(t, "test_payload", backupDir, ts2) // most recent, but we want to restore ts1

	// Modify working config (simulate corruption/change)
	require.NoError(t, os.Remove(filepath.Join(workingConfigDir, "gateway_config.yaml")))

	// Restore from timestamp (oldest backup)
	require.NoError(t, restoreConfigFromTimestamp(strconv.FormatInt(ts1, 10)))

	// working config dir should match the chosen backup
	dirsEqual(t, filepath.Join(backupDir, b1), workingConfigDir)
}

func TestRestoreConfigFromBackupFolder_Rollback(t *testing.T) {
	// Prepare a temp working config dir (copy test_payload)
	workingConfigDir := t.TempDir()
	require.NoError(t, copyDir("test_payload", workingConfigDir))

	origConfigDir := environment.SetConfigRootDirectory(workingConfigDir)
	defer func() { environment.SetConfigRootDirectory(origConfigDir) }()

	backupDir := t.TempDir()
	origBackupDir := environment.SetConfigBackupDirectory(backupDir)
	defer func() { environment.SetConfigBackupDirectory(origBackupDir) }()

	// Create a broken backup (simulate failure: create a folder with unreadable file)
	badTs := time.Now().Unix()
	badBackup := createBackupFolder(t, "test_payload", backupDir, badTs)
	badFile := filepath.Join(backupDir, badBackup, "bad.txt")
	require.NoError(t, os.WriteFile(badFile, []byte("bad!"), 0)) // permissions 0 = unreadable

	// Modify working config before restore
	touchFile := filepath.Join(workingConfigDir, "checkme.txt")
	require.NoError(t, os.WriteFile(touchFile, []byte("should survive rollback"), 0o644))

	// Attempt restore from bad backup: should fail and rollback to previous state
	err := restoreConfigFromBackupFolder(badBackup)
	require.Error(t, err, "Restore from broken backup should fail")

	// Assert: check working config still contains the marker file (rollback worked)
	data, err := os.ReadFile(touchFile)
	require.NoError(t, err)
	require.Equal(t, "should survive rollback", string(data))
}

func TestCleanAll(t *testing.T) {
	// Prepare a temp working config dir (copy test_payload)
	workingConfigDir := t.TempDir()
	require.NoError(t, copyDir("test_payload", workingConfigDir))

	// Set env so CleanAll uses our temp dir
	origConfigDir := environment.SetConfigRootDirectory(workingConfigDir)
	defer func() { environment.SetConfigRootDirectory(origConfigDir) }()

	// Sanity check: working dir is not empty
	entries, err := os.ReadDir(workingConfigDir)
	require.NoError(t, err)
	require.NotEmpty(t, entries)

	require.NoError(t, cleanAll())

	// Assert: working dir still exists, but is empty
	entries, err = os.ReadDir(workingConfigDir)
	require.NoError(t, err)
	require.Empty(t, entries)
}

// Helper to create a backup folder with a specific timestamp
func createBackupFolder(t *testing.T, source, dir string, ts int64) string {
	name := configBackupPrefix + strconv.FormatInt(ts, 10)
	full := filepath.Join(dir, name)
	require.NoError(t, os.MkdirAll(full, 0o755))

	err := copyDir(source, full)
	require.NoError(t, err, "Failed to copy dir to backup")

	return name
}

// dirsEqual recursively compare two directories for files, structure, permissions, and contents.
func dirsEqual(t *testing.T, a, b string) {
	entriesA, err := os.ReadDir(a)
	require.NoError(t, err, "Failed to read dir A: %s", a)
	entriesB, err := os.ReadDir(b)
	require.NoError(t, err, "Failed to read dir B: %s", b)
	require.Equal(t, len(entriesA), len(entriesB), "Different number of entries: %s vs %s", a, b)

	entryMapB := make(map[string]os.DirEntry, len(entriesB))
	for _, e := range entriesB {
		entryMapB[e.Name()] = e
	}

	for _, entryA := range entriesA {
		entryB, ok := entryMapB[entryA.Name()]
		require.True(t, ok, "Entry missing in B: %s", entryA.Name())

		infoA, err := entryA.Info()
		require.NoError(t, err, "Info error A: %s", entryA.Name())
		infoB, err := entryB.Info()
		require.NoError(t, err, "Info error B: %s", entryB.Name())

		require.Equal(t, infoA.Mode(), infoB.Mode(), "Mode mismatch for: %s", entryA.Name())
		require.Equal(t, entryA.IsDir(), entryB.IsDir(), "Dir/file mismatch for: %s", entryA.Name())

		pathA := filepath.Join(a, entryA.Name())
		pathB := filepath.Join(b, entryB.Name())

		if entryA.IsDir() {
			dirsEqual(t, pathA, pathB)
		} else {
			dataA, err := os.ReadFile(pathA)
			require.NoError(t, err, "Failed to read file in A: %s", pathA)
			dataB, err := os.ReadFile(pathB)
			require.NoError(t, err, "Failed to read file in B: %s", pathB)
			require.Equal(t, dataA, dataB, "Content mismatch in: %s", entryA.Name())
		}
	}
}
