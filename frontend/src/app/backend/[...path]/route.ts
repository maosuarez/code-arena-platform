import { NextRequest, NextResponse } from "next/server"

const BACKEND_URL = process.env.BACKEND_INTERNAL_URL || "http://localhost:8000"

async function proxy(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
): Promise<NextResponse> {
  const { path } = await params
  const { search } = new URL(request.url)
  const targetUrl = `${BACKEND_URL}/${path.join("/")}${search}`

  const headers = new Headers()
  const contentType = request.headers.get("content-type")
  if (contentType) headers.set("content-type", contentType)
  const auth = request.headers.get("authorization")
  if (auth) headers.set("authorization", auth)

  const hasBody = request.method !== "GET" && request.method !== "HEAD"
  const fetchOptions: RequestInit & { duplex?: string } = {
    method: request.method,
    headers,
    ...(hasBody && { body: request.body, duplex: "half" }),
  }

  const upstream = await fetch(targetUrl, fetchOptions)

  const responseHeaders = new Headers()
  const ct = upstream.headers.get("content-type")
  if (ct) responseHeaders.set("content-type", ct)

  return new NextResponse(upstream.body, {
    status: upstream.status,
    headers: responseHeaders,
  })
}

export const GET = proxy
export const POST = proxy
export const PUT = proxy
export const DELETE = proxy
export const PATCH = proxy
