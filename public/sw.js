/*
 * Service worker do Axis: só notificações. Não guarda páginas em cache — o
 * sistema lida com dado sensível e sempre lê do servidor.
 */

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (evento) => evento.waitUntil(self.clients.claim()));

self.addEventListener("push", (evento) => {
  let dados = {};
  try {
    dados = evento.data ? evento.data.json() : {};
  } catch {
    dados = { corpo: evento.data ? evento.data.text() : "" };
  }

  evento.waitUntil(
    (async () => {
      // O iOS exige mostrar uma notificação para cada push recebido.
      await self.registration.showNotification(dados.titulo || "Axis", {
        body: dados.corpo || "",
        tag: dados.tag,
        icon: "/icones/192",
        badge: "/icones/192",
        data: { url: dados.url || "/" },
      });
      // Com o app aberto, o sino atualiza na hora.
      const janelas = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const janela of janelas) janela.postMessage({ tipo: "axis-notificacao" });
    })(),
  );
});

self.addEventListener("notificationclick", (evento) => {
  evento.notification.close();
  const destino = new URL((evento.notification.data && evento.notification.data.url) || "/", self.location.origin);
  // Só abre endereço do próprio sistema.
  const url = destino.origin === self.location.origin ? destino.href : self.location.origin;

  evento.waitUntil(
    (async () => {
      const janelas = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const janela of janelas) {
        if ("focus" in janela) {
          await janela.focus();
          if ("navigate" in janela) await janela.navigate(url);
          return;
        }
      }
      await self.clients.openWindow(url);
    })(),
  );
});
