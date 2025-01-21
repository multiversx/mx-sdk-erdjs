import { assert } from "chai";
import { MarkCompleted, MockNetworkProvider, Wait } from "./testutils";
import { TransactionHash } from "./transaction";
import { TransactionOnNetwork } from "./transactionOnNetwork";
import { TransactionStatus } from "./transactionStatus";
import { TransactionWatcher } from "./transactionWatcher";

describe("test transactionWatcher", () => {
    it("should await status == executed using hash", async () => {
        let hash = new TransactionHash("abbaabbaabbaabbaabbaabbaabbaabbaabbaabbaabbaabbaabbaabbaabbaabba");
        let provider = new MockNetworkProvider();
        let watcher = new TransactionWatcher(provider, {
            pollingIntervalMilliseconds: 42,
            timeoutMilliseconds: 42 * 42,
        });
        let dummyTransaction = {
            getHash: () => hash,
        };

        provider.mockPutTransaction(
            hash,
            new TransactionOnNetwork({
                status: new TransactionStatus("unknown"),
            }),
        );

        await Promise.all([
            provider.mockTransactionTimelineByHash(hash, [
                new Wait(40),
                new TransactionStatus("pending"),
                new Wait(40),
                new TransactionStatus("executed"),
                new MarkCompleted(),
            ]),
            watcher.awaitCompleted(dummyTransaction.getHash().hex()),
        ]);

        assert.isTrue((await provider.getTransactionStatus(hash.hex())).isCompleted());
    });

    it("should await status == executed using transaction", async () => {
        let hash = new TransactionHash("abbaabbaabbaabbaabbaabbaabbaabbaabbaabbaabbaabbaabbaabbaabbaabba");
        let provider = new MockNetworkProvider();
        let watcher = new TransactionWatcher(provider, {
            pollingIntervalMilliseconds: 42,
            timeoutMilliseconds: 42 * 42,
        });
        let dummyTransaction = {
            getHash: () => hash,
        };

        provider.mockPutTransaction(
            hash,
            new TransactionOnNetwork({
                status: new TransactionStatus("unknown"),
            }),
        );

        await Promise.all([
            provider.mockTransactionTimelineByHash(hash, [
                new Wait(40),
                new TransactionStatus("pending"),
                new Wait(40),
                new TransactionStatus("executed"),
                new MarkCompleted(),
            ]),
            watcher.awaitCompleted(dummyTransaction),
        ]);

        assert.isTrue((await provider.getTransactionStatus(hash.hex())).isCompleted());
    });
});
