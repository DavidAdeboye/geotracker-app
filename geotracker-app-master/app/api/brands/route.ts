import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/lib/db/supabase";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isValidUuid(value: string) {
  return typeof value === "string" && UUID_RE.test(value.trim());
}

async function resolveUserId(supabase: ReturnType<typeof getServiceClient>, rawUserId: string) {
  const userId = rawUserId?.trim();

  if (!userId) {
    throw new Error("userId is required");
  }

  if (isValidUuid(userId)) {
    return userId;
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error("userId must be a valid UUID in production");
  }

  const devEmail = `${userId.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "dev-user"}@geotracker.local`;
  const devPassword = "TestPassword123!";

  const { data: listData, error: listError } = await supabase.auth.admin.listUsers();
  if (listError) {
    throw new Error(listError.message ?? `Unable to inspect dev users for ${userId}`);
  }

  const existingUser = listData?.users?.find(
    (candidate) =>
      candidate.id === userId ||
      candidate.email === devEmail ||
      candidate.user_metadata?.dev_user_id === userId
  );

  if (existingUser?.id) {
    return existingUser.id;
  }

  const { data, error } = await supabase.auth.admin.createUser({
    email: devEmail,
    password: devPassword,
    email_confirm: true,
    user_metadata: { dev_user_id: userId },
  });

  if (error || !data?.user?.id) {
    throw new Error(error?.message ?? `Unable to create a dev user for ${userId}`);
  }

  return data.user.id;
}

// POST /api/brands — create a brand
// body: { userId: string, name: string, category: string }
export async function POST(req: NextRequest) {
  const { userId, name, category } = await req.json();

  if (!userId || !name || !category) {
    return NextResponse.json({ error: "userId, name, and category are required" }, { status: 400 });
  }

  const supabase = getServiceClient();

  try {
    const resolvedUserId = await resolveUserId(supabase, userId);
    const { data, error } = await supabase
      .from("brands")
      .insert({ user_id: resolvedUserId, name, category })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ brand: data }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to create brand";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

// GET /api/brands?userId=... — list a user's brands
export async function GET(req: NextRequest) {
  const rawUserId = req.nextUrl.searchParams.get("userId");
  if (!rawUserId) {
    return NextResponse.json({ error: "userId query param is required" }, { status: 400 });
  }

  const supabase = getServiceClient();

  try {
    const userId = await resolveUserId(supabase, rawUserId);
    const { data, error } = await supabase.from("brands").select("*").eq("user_id", userId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ brands: data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to fetch brands";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
