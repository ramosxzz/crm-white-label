import { NextResponse } from "next/server";
import { ApiError } from "@/lib/api/auth";

export const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export function apiJson<T>(data: T, init?: { status?: number }) {
  return NextResponse.json(data, { status: init?.status ?? 200, headers: CORS_HEADERS });
}

export function apiErrorResponse(error: unknown) {
  if (error instanceof ApiError) {
    return NextResponse.json(
      { error: { code: error.code, message: error.message } },
      { status: error.status, headers: CORS_HEADERS },
    );
  }
  console.error(error);
  return NextResponse.json(
    { error: { code: "internal_error", message: "Erro interno" } },
    { status: 500, headers: CORS_HEADERS },
  );
}
