/**
 * Política mínima de senha. Roda no formulário, para o aviso aparecer antes do
 * envio, e no servidor, que é quem de fato recusa.
 */

export const SENHA_MIN = 10;
export const SENHA_MAX = 128;

/** As mais usadas no Brasil e no mundo, já normalizadas em minúsculas. */
const COMUNS = new Set([
  "1234567890",
  "12345678910",
  "0123456789",
  "1234567891",
  "senha12345",
  "senha123456",
  "password123",
  "password1234",
  "qwertyuiop",
  "qwerty12345",
  "abc1234567",
  "brasil1234",
  "brasil12345",
  "mudar12345",
  "trocar12345",
  "axis123456",
  "axis12345678",
  "admin12345",
  "admin123456",
  "iloveyou12",
  "1q2w3e4r5t",
  "1qaz2wsx3edc",
  "0987654321",
  "1111111111",
  "aaaaaaaaaa",
]);

/** Devolve o motivo da recusa, ou `null` quando a senha serve. */
export function problemaDaSenha(senha: string, email?: string): string | null {
  if (senha.length < SENHA_MIN) return `Use pelo menos ${SENHA_MIN} caracteres.`;
  if (senha.length > SENHA_MAX) return `Use no máximo ${SENHA_MAX} caracteres.`;
  if (!/[a-zA-Z]/.test(senha) || !/\d/.test(senha)) {
    return "Misture letras e números.";
  }
  if (/^(.)\1+$/.test(senha)) return "Não repita o mesmo caractere.";
  const normalizada = senha.toLowerCase();
  if (COMUNS.has(normalizada)) return "Essa senha é muito comum. Escolha outra.";
  const usuario = email?.split("@")[0]?.toLowerCase();
  if (usuario && usuario.length >= 4 && normalizada.includes(usuario)) {
    return "A senha não pode conter o seu e-mail.";
  }
  return null;
}

/**
 * Senha provisória legível para o Admin passar a alguém: sem caracteres que
 * se confundem (0/O, 1/l/I) e sempre com letra e número.
 */
export function gerarSenhaProvisoria(tamanho = 12): string {
  const letras = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ";
  const numeros = "23456789";
  const todos = letras + numeros;
  const aleatorios = new Uint32Array(tamanho);
  crypto.getRandomValues(aleatorios);
  const chars = Array.from(aleatorios, (n) => todos[n % todos.length]);
  chars[0] = letras[aleatorios[0] % letras.length];
  chars[tamanho - 1] = numeros[aleatorios[tamanho - 1] % numeros.length];
  return chars.join("");
}
