const workingResponse = () =>
  new Response("working", {
    headers: {
      "Content-Type": "text/plain",
    },
  });

export function GET() {
  return workingResponse();
}

export function POST() {
  return workingResponse();
}
