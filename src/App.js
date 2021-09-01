import { useEffect, useState } from "react";
import { useWeb3React } from "@web3-react/core";
import { NetworkConnector } from "@web3-react/network-connector";
import "./App.css";
import { useTCRView } from "./hooks";
import { formatEther } from "ethers/lib/utils";

const networkConnector = new NetworkConnector({
  urls: { 42: process.env.REACT_APP_JSON_RPC },
  defaultChainId: 42,
});

function App() {
  const { activate, active } = useWeb3React();
  const [activating, setActivating] = useState();
  const [error, setError] = useState();
  const data = useTCRView(process.env.REACT_APP_LIGHT_GTCR_ADDRESS);

  useEffect(() => {
    if (active || activating) return;
    setActivating(true);

    activate(networkConnector, undefined, true)
      .then(() => {
        setActivating(false);
      })
      .catch((err) => {
        console.error(err);
        setError(err);
      });
  }, [activate, activating, active]);

  const errored = error || (data && data.tcrError);

  const loading = !data || data.loading || !data.submissionDeposit;

  if (errored)
    return (
      <div className="App">
        <header className="App-header">
          <p style={{ maxWidth: `500px` }}>
            <code>{JSON.stringify(errored, null, 2)}</code>
          </p>
        </header>
      </div>
    );

  if (loading)
    return (
      <div className="App">
        <header className="App-header">Loading...</header>
      </div>
    );

  return (
    <div className="App">
      <header className="App-header">
        <p>
          Deposit{" "}
          <code>
            {formatEther(data.submissionDeposit ? data.submissionDeposit : 0)}{" "}
            ETH
          </code>
        </p>
      </header>
    </div>
  );
}

export default App;
