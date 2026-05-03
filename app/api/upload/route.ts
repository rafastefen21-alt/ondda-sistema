import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";

const ALLOWED_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif"];
const MAX_SIZE = 5 * 1024 * 1024; // 5 MB

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.tenantId) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }
  if (!["TENANT_ADMIN", "GERENTE"].includes(session.user.role)) {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json(
      { error: "Supabase Storage não configurado. Adicione SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env" },
      { status: 500 }
    );
  }

  const formData = await req.formData();
  const file = formData.get("file") as File | null;

  if (!file) {
    return NextResponse.json({ error: "Nenhum arquivo enviado." }, { status: 400 });
  }

  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json(
      { error: "Formato inválido. Use JPG, PNG, WEBP ou GIF." },
      { status: 400 }
    );
  }

  if (file.size > MAX_SIZE) {
    return NextResponse.json(
      { error: "Arquivo muito grande. Máximo 5 MB." },
      { status: 400 }
    );
  }

  const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
  const filename = `${session.user.tenantId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

  const bytes = await file.arrayBuffer();

  // Upload to Supabase Storage (bucket: Produtos)
  const uploadRes = await fetch(
    `${supabaseUrl}/storage/v1/object/Produtos/${filename}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${serviceRoleKey}`,
        "Content-Type": file.type,
        "x-upsert": "true",
      },
      body: bytes,
    }
  );

  if (!uploadRes.ok) {
    const err = await uploadRes.json().catch(() => ({}));
    console.error("Supabase Storage error:", err);

    // Bucket not found → guide user to create it
    if (uploadRes.status === 404 || (err as { error?: string }).error === "Bucket not found") {
      return NextResponse.json(
        { error: 'Bucket "Produtos" não existe no Supabase Storage. Crie-o em: Storage → New bucket → nome: Produtos → Public: ativado.' },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { error: "Erro ao fazer upload da imagem." },
      { status: 500 }
    );
  }

  const publicUrl = `${supabaseUrl}/storage/v1/object/public/Produtos/${filename}`;

  return NextResponse.json({ url: publicUrl });
}
