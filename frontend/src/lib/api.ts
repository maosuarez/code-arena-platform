type RequestOptions = {
  method?: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
  params?: Record<string, string | number>;
  body?: unknown;
  headers?: Record<string, string>;
  token?: boolean
};

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "";
console.debug(`[API] BASE_URL="${BASE_URL}"`);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function apiRequest<T = any>(
  endpoint: string,
  options: RequestOptions & { useForm?: boolean } = {}
): Promise<T> {
  const {
    method = "GET",
    params,
    body,
    headers = {},
    token = false,
    useForm = false, // 👈 Nuevo flag para usar FormData
  } = options

  // Construir query string si hay params
  const query = params
    ? "?" +
      Object.entries(params)
        .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
        .join("&")
    : ""

  const url = `${BASE_URL}${endpoint}${query}`
  const start = performance.now()
  console.debug(`[API] ${method} ${url}`)

  // Construir headers
  const finalHeaders: HeadersInit = {
    ...headers,
  }

  // Si no es FormData, usar JSON por defecto
  if (!useForm) {
    finalHeaders["Content-Type"] = "application/json"
  }

  // Incluir token si se solicita
  if (token) {
    const storedToken = localStorage.getItem("token")
    if (storedToken) {
      finalHeaders["Authorization"] = `Bearer ${storedToken}`
    }
  }

  // Construir body
  let finalBody: BodyInit | undefined = undefined

  if (method !== "GET") {
    if (useForm) {
      const formData = new FormData()
      Object.entries(body || {}).forEach(([key, value]) => {
        formData.append(key, value as string | Blob)
      })
      finalBody = formData
    } else {
      finalBody = JSON.stringify(body)
    }
  }

  const response = await fetch(url, {
    method,
    headers: finalHeaders,
    body: finalBody,
  })

  if (!response.ok) {
    const text = await response.text()
    let detail = `Error ${response.status}`
    try {
      const error = JSON.parse(text)
      detail = error.detail || error.message || detail
    } catch {
      if (text) detail = text
    }
    const duration = Math.round(performance.now() - start)
    console.warn(`[API] ${method} ${url} → ${response.status} (${duration}ms) — ${detail}`)
    throw new Error(detail)
  }

  const duration = Math.round(performance.now() - start)
  console.debug(`[API] ${method} ${url} → ${response.status} (${duration}ms)`)
  const text = await response.text()
  if (!text) return undefined as T
  return JSON.parse(text)
}

