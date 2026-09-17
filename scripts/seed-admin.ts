/**
 * Cria o administrador inicial. É o único seed do sistema.
 *
 *   npm run db:seed
 *
 * Lê ADMIN_INICIAL_NOME, ADMIN_INICIAL_EMAIL e ADMIN_INICIAL_SENHA. A senha é
 * provisória: o primeiro acesso obriga a trocá-la, aceitar o termo e ativar a
 * verificação em duas etapas. Rodar de novo não duplica nada.
 */
import { eq } from "drizzle-orm";
import { problemaDaSenha } from "@/lib/senha";
import { agoraISO } from "@/lib/iso";
import { auth } from "@/lib/servidor/auth";
import { db } from "@/lib/servidor/db";
import { atividades, colaboradores, user } from "@/lib/servidor/schema";

async function principal() {
  const nome = process.env.ADMIN_INICIAL_NOME?.trim();
  const email = process.env.ADMIN_INICIAL_EMAIL?.trim().toLowerCase();
  const senha = process.env.ADMIN_INICIAL_SENHA;
  if (!nome || !email || !senha) {
    throw new Error("Defina ADMIN_INICIAL_NOME, ADMIN_INICIAL_EMAIL e ADMIN_INICIAL_SENHA.");
  }
  const problema = problemaDaSenha(senha, email);
  if (problema) throw new Error(`ADMIN_INICIAL_SENHA recusada: ${problema}`);

  const [existente] = await db.select().from(user).where(eq(user.email, email)).limit(1);
  if (existente) {
    console.log(`Já existe um usuário com ${email}. Nada foi alterado.`);
    return;
  }

  const { user: criado } = await auth.api.createUser({
    body: { email, password: senha, name: nome, role: "admin" },
  });
  const agora = agoraISO();
  await db.transaction(async (tx) => {
    await tx.update(user).set({ trocarSenha: true }).where(eq(user.id, criado.id));
    await tx.insert(colaboradores).values({
      id: criado.id,
      nome,
      apelido: nome.split(/\s+/)[0] ?? nome,
      email,
      perfil: "admin",
      setor: "administracao",
      entrouEm: agora,
    });
    await tx.insert(atividades).values({
      id: crypto.randomUUID(),
      usuarioId: null,
      papel: "sistema",
      acao: "criacao",
      entidade: "colaborador",
      entidadeId: criado.id,
      ocorridoEm: agora,
      titulo: "Administrador inicial criado pelo seed",
      depois: { nome, email, perfil: "admin" },
    });
  });
  console.log(`Administrador ${email} criado. Troca de senha obrigatória no primeiro acesso.`);
}

principal()
  .then(() => process.exit(0))
  .catch((erro) => {
    console.error(erro instanceof Error ? erro.message : erro);
    process.exit(1);
  });
