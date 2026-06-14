type RequestOptions = {
  method?: "GET" | "POST" | "PUT" | "DELETE";
  params?: Record<string, string | number>;
  body?: unknown;
  headers?: Record<string, string>;
  token?: boolean
};

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "";

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

  console.log("URL final:", url)

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
    const error = await response.json()
    throw new Error(error.message || "Error en la solicitud")
  }

  return response.json()
}

