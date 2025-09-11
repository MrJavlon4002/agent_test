from keys import GEMINI_API_KEY
import asyncio
from fastmcp import Client
from google import genai

gemini_client = genai.Client(api_key=GEMINI_API_KEY)
mcp_client = Client("server.py")

async def llm_call(query, history, session_id: str):
    system = (
        "You are a helpful financial assistant who speaks in Uzbek.\n"
        f"SESSION_ID={session_id}\n"
        "IMPORTANT: For every MCP tool call, include the argument session_id=SESSION_ID."
    )

    async with mcp_client:
        contents = f"history: {history}\n\n{query}"
        response = await gemini_client.aio.models.generate_content(
            model="gemini-2.5-flash",
            contents=contents,
            config=genai.types.GenerateContentConfig(
                temperature=0,
                tools=[mcp_client.session],
                system_instruction=system,
            ),
        )
        return response.candidates[0].content.parts[0].text

if __name__ == "__main__":
    asyncio.run(llm_call("Salom!", [], session_id="dev-session"))
