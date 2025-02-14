const fs = require('fs');
const path = require('path');


class NoProxyUseError extends Error {
  constructor(message) {
    super(message);
    this.name = 'NoProxyUseError';
  }
}

function importSDKs(folderPath) {
  const sdks = [];
  if (!fs.existsSync(folderPath)) {
    console.error(`Folder not found: ${folderPath}`);
    return;
  }

  fs.readdirSync(folderPath).forEach(fileName => {
    const filePath = path.join(folderPath, fileName);

    if (fs.statSync(filePath).isFile() && fileName.endsWith('.sdk.js')) {
      try {
        const sdk = require(filePath);
        sdks.push(new sdk());
        console.log(`Imported successfully: ${filePath}`);
      } catch (error) {
        console.error(`Error importing ${filePath}:`, error);
      }
    }
  });

  return sdks;
}



module.exports = {
  NoProxyUseError,
  importSDKs,
};