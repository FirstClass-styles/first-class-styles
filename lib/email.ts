import tls from "node:tls";

const EMAIL_USER = process.env.EMAIL_USER;
const EMAIL_APP_PASSWORD = process.env.EMAIL_APP_PASSWORD;

async function smtpSend(to: string, subject: string, body: string) {
  if (!EMAIL_USER || !EMAIL_APP_PASSWORD) throw new Error("Email is not configured.");

  const socket = tls.connect({ host: "smtp.gmail.com", port: 465, servername: "smtp.gmail.com" });
  socket.setTimeout(15000);
  let buffer = "";
  let pending: Array<(value: string) => void> = [];
  let closedError: Error | null = null;

  socket.on("data", (chunk: Buffer) => {
    buffer += chunk.toString("utf8");
    const lines = buffer.split("\r\n");
    buffer = lines.pop() || "";
    for (const line of lines) {
      const waiter = pending[0];
      if (waiter) waiter(line);
      else buffer = line + "\r\n" + buffer;
    }
  });
  socket.on("error", (error) => { closedError = error; while (pending.length) pending.shift()!(""); });
  socket.on("timeout", () => { closedError = new Error("Email connection timed out."); socket.destroy(); });

  const readResponse = async () => {
    const lines: string[] = [];
    while (true) {
      if (closedError) throw closedError;
      const line = await new Promise<string>((resolve) => pending.push(resolve));
      if (!line) throw closedError || new Error("Email server closed the connection.");
      lines.push(line);
      if (/^\d{3} /.test(line)) break;
    }
    const response = lines.join("\n");
    if (!/^[23]/.test(lines[lines.length - 1])) throw new Error("Email server rejected a command: " + response);
    return response;
  };
  const command = async (value: string) => {
    socket.write(value + "\r\n");
    return readResponse();
  };

  try {
    await new Promise<void>((resolve, reject) => {
      socket.once("secureConnect", resolve);
      socket.once("error", reject);
    });
    await readResponse();
    await command("EHLO first-class-styles.vercel.app");
    await command("AUTH LOGIN");
    await command(Buffer.from(EMAIL_USER).toString("base64"));
    await command(Buffer.from(EMAIL_APP_PASSWORD.replace(/\s/g, "")).toString("base64"));
    await command("MAIL FROM:<" + EMAIL_USER + ">");
    await command("RCPT TO:<" + to + ">");
    await command("DATA");

    const safeSubject = subject.replace(/[\r\n]/g, " ").replace(/[^\x20-\x7E]/g, "");
    const safeBody = body.replace(/\r?\n/g, "\r\n").replace(/^\./gm, "..");
    const message = [
      "From: First Class Styles <" + EMAIL_USER + ">",
      "To: " + to,
      "Subject: " + safeSubject,
      "MIME-Version: 1.0",
      'Content-Type: text/plain; charset="UTF-8"',
      "Content-Transfer-Encoding: 8bit",
      "",
      safeBody,
      ".",
      "",
    ].join("\r\n");
    socket.write(message);
    await readResponse();
    await command("QUIT");
  } finally {
    socket.end();
  }
}

export async function sendEmail(to: string, subject: string, body: string) {
  await smtpSend(to, subject, body);
}

export function bookingDateTime(iso: string) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(new Date(iso));
}
