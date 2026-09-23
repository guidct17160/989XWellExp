const fs = require('fs');
const path = require('path');
const babel = require('../../app/node_modules/@babel/core');

const appDir = path.resolve(__dirname, '../../app');
const appSrcDir = path.resolve(appDir, 'src');

function getFiles(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat && stat.isDirectory()) {
      results = results.concat(getFiles(fullPath));
    } else if (file.endsWith('.js') || file.endsWith('.jsx')) {
      results.push(fullPath);
    }
  });
  return results;
}

const files = getFiles(appSrcDir);
console.log(`\n📱 Scanning and validating ${files.length} Mobile App source files using Expo Babel configuration...`);

let errors = 0;
files.forEach(f => {
  const code = fs.readFileSync(f, 'utf8');
  try {
    babel.transformSync(code, {
      filename: f,
      cwd: appDir,
      configFile: path.join(appDir, 'babel.config.js'),
    });
  } catch (err) {
    console.error(`  ❌ Syntax Error in ${path.relative(appSrcDir, f)}:`, err.message);
    errors++;
  }
});

if (errors === 0) {
  console.log(`  🎉 SUCCESS: All ${files.length} Mobile App files (including MissionsScreen.js) compiled & validated cleanly with 0 errors!\n`);
  process.exit(0);
} else {
  console.error(`  ❌ Found ${errors} syntax errors in Mobile App.\n`);
  process.exit(1);
}
