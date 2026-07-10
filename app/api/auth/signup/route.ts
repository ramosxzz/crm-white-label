import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST() {
  return NextResponse.json(
    {
      error:
        "Criacao publica de contas desativada. Solicite uma demo pelo WhatsApp para liberar o acesso.",
    },
    { status: 403 },
  );
}
