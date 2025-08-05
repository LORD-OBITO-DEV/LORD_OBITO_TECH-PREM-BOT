import fs from 'fs';

const adminsFile = './admins.json';

function getAdmins() {
  const data = fs.readFileSync(adminsFile, 'utf8');
  return JSON.parse(data);
}

function saveAdmins(adminList) {
  fs.writeFileSync(adminsFile, JSON.stringify(adminList, null, 2));
}

// ✅ Export des fonctions
export { getAdmins, saveAdmins };
