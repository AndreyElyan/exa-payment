const { execSync, exec } = require('child_process');
const fs = require('fs');
const path = require('path');

const ICON = '🤖';

console.log(`${ICON} Iniciando build do monorepo...`);

const appsDir = './apps';
const libsDir = './libs';

const excludedApps = ['consumer'];

function getDirectories(dir) {
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((dirent) => dirent.isDirectory())
    .map((dirent) => dirent.name);
}

async function buildLibraries() {
  console.log(`${ICON} Buildando bibliotecas...`);

  const libs = getDirectories(libsDir);

  for (const lib of libs) {
    console.log(`${ICON} Buildando lib: ${lib}`);
    try {
      execSync(`npx tsc -p libs/${lib}/tsconfig.lib.json`, { stdio: 'inherit' });
      console.log(`${ICON} ✅ Lib ${lib} buildada com sucesso`);
    } catch (error) {
      console.error(`${ICON} ❌ Erro ao buildar lib ${lib}:`, error.message);
      process.exit(1);
    }
  }
}

async function buildApplications() {
  console.log(`${ICON} Buildando aplicações...`);

  const apps = getDirectories(appsDir);
  const buildPromises = apps
    .filter((app) => !excludedApps.includes(app))
    .map((app) => {
      return new Promise((resolve, reject) => {
        console.log(`${ICON} Buildando app: ${app}`);
        exec(`npx tsc -p apps/${app}/tsconfig.app.json`, (error, stdout, stderr) => {
          if (error) {
            console.error(`${ICON} ❌ Erro ao buildar app ${app}:`, error.message);
            reject(error);
          } else {
            console.log(`${ICON} ✅ App ${app} buildado com sucesso`);
            resolve();
          }
        });
      });
    });

  try {
    await Promise.all(buildPromises);
    console.log(`${ICON} ✅ Todos os apps foram buildados com sucesso`);
  } catch (error) {
    console.error(`${ICON} ❌ Erro durante o build dos apps:`, error.message);
    process.exit(1);
  }
}

async function main() {
  try {
    await buildLibraries();
    await buildApplications();
    console.log(`${ICON} ✅ Build completo finalizado com sucesso!`);
  } catch (error) {
    console.error(`${ICON} ❌ Erro durante o build:`, error.message);
    process.exit(1);
  }
}

main();
