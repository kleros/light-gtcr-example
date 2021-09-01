import { useCallback, useEffect, useState } from "react";
import { useWeb3React } from "@web3-react/core";
import { NetworkConnector } from "@web3-react/network-connector";
import { TCRView } from "./components";
import "./App.css";

const networkConnector = new NetworkConnector({
  urls: { 42: process.env.REACT_APP_JSON_RPC },
  defaultChainId: 42,
});

function App() {
  const { activate, active } = useWeb3React();
  const [error, setError] = useState();
  const [activating, setActivating] = useState();

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

  const onSubmit = useCallback(() => {
    (async () => {
      const gtcr = new ethers.Contract(tcrAddress, _gtcr, signer);
      const enc = new TextEncoder();
      const fileData = enc.encode(JSON.stringify({ columns, values }));
      const ipfsEvidenceObject = await ipfsPublish("item.json", fileData);
      const ipfsEvidencePath = `/ipfs/${
        ipfsEvidenceObject[1].hash + ipfsEvidenceObject[0].path
      }`;

      // Request signature and submit.
      const tx = await gtcr.addItem(ipfsEvidencePath, {
        value: submissionDeposit,
      });
    })();
  }, []);

  return (
    <div className="App">
      <header className="App-header">
        <h1>Light Curate Example</h1>
      </header>
      {error}
      <TCRView />
      <button onClick={onSubmit}>Submit New Item</button>
    </div>
  );
}

export default App;
