/**
 * Reset de contraseña para un usuario.
 *
 * Uso:
 *   npx tsx prisma/reset-password.ts <username> <nueva-contraseña>
 *
 * Ejemplo:
 *   npx tsx prisma/reset-password.ts maria_lopez NuevaPassword123
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const [, , username, newPassword] = process.argv;

  if (!username || !newPassword) {
    console.error("❌ Uso: npx tsx prisma/reset-password.ts <username> <nueva-contraseña>");
    process.exit(1);
  }

  if (newPassword.length < 6) {
    console.error("❌ La contraseña debe tener al menos 6 caracteres");
    process.exit(1);
  }

  const user = await prisma.user.findUnique({ where: { username } });
  if (!user) {
    console.error(`❌ No existe usuario "${username}"`);
    console.log("\n📋 Usuarios existentes:");
    const all = await prisma.user.findMany({ select: { username: true } });
    for (const u of all) {
      console.log(`   - ${u.username}`);
    }
    process.exit(1);
  }

  const passwordHash = await bcrypt.hash(newPassword, 10);
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash },
  });

  console.log(`✅ Contraseña actualizada para "${username}"`);
  console.log(`   Mándale la nueva contraseña por mensaje privado para que entre.`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
