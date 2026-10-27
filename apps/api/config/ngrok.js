import ngrok from "@ngrok/ngrok";

export async function forwardToApp() {
  const forwarder = await ngrok.forward({
    addr: "localhost:8000",
    authtoken_from_env: true,
    domain: "wish-sway-imagines.ngrok-free.dev",
  });
  console.log(`Available at: ${forwarder.url()}`);
}

