# Characterization note (see docs/core-extraction-notes.md): async/await
# parses correctly and produces correct control flow, but PyAstParser
# gives it no distinct semantic node type today -- `await` calls surface
# as generic "process"/"assignment" nodes, same as any other statement.
# This fixture documents that real, current behavior; it is not something
# this commit changes.
async def fetch_data(session, url):
    async with session.get(url) as resp:
        data = await resp.json()
        if not data:
            return None
        for item in data:
            await process(item)
        return data
