import aiohttp

class Request:
    
    async def get(url: str):
        async with aiohttp.ClientSession() as session:
            async with session.get(url) as response:
                return await response.text()