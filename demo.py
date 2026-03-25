# demo.py — Lucid Debugger Demo Program
# Run: python demo.py (or debug it with Lucid)
#
# Bug 1: async race condition — two coroutines mutate shared_list without a lock
#        Elements get duplicated when coroutines interleave at await points
#
# Bug 2: counter is never reset — processItems() uses a global it doesn't own
#
# Demo flow:
#   1. Launch with Lucid (Python), set breakpoint on line 27 (shared_list.append)
#   2. Step through — watch shared_list grow in the variables panel
#   3. History timeline shows the list length growing at each step
#   4. Explain Bug → AI spots the missing lock / non-atomic append
#   5. Beginner mode → plain-English explanation: "two tasks are writing at the same time"
#   6. Session narrative → AI writes a summary of the whole debug session

import asyncio

shared_list = []   # BUG: accessed by multiple coroutines without a lock
call_count  = 0    # BUG: global that no one resets

async def producer(name: str, count: int) -> None:
    """Adds count items to shared_list. Race condition with other producers."""
    global call_count
    for i in range(count):
        await asyncio.sleep(0)            # yields to event loop — interleaving happens here
        value = f"{name}-{i}"
        shared_list.append(value)         # line 27 — set breakpoint here
        call_count += 1
        print(f"  [{name}] appended {value!r}, list now has {len(shared_list)} items")

async def processItems(items: list) -> list:
    """Processes a list of items — doubles each one."""
    result = []
    for item in items:
        await asyncio.sleep(0)            # simulate async I/O
        processed = item.upper() + "!"
        result.append(processed)
    return result

async def main() -> None:
    print("Starting producers...")
    # Two producers running concurrently — they interleave at every await
    await asyncio.gather(
        producer("A", 5),
        producer("B", 5),
    )

    expected = 10
    actual   = len(shared_list)
    print(f"\nProducers done.")
    print(f"Expected {expected} items, got {actual}.")
    if actual != expected:
        print("BUG: list has wrong number of items!")

    print(f"Total call_count: {call_count}")

    # Further processing
    print("\nProcessing items...")
    processed = await processItems(shared_list[:5])
    print(f"Processed: {processed}")

    print("\nFinal shared_list:", shared_list)

if __name__ == "__main__":
    asyncio.run(main())
