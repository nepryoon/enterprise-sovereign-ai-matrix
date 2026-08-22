# Invocation cost model

The backend `CostCalculator` is authoritative. It multiplies provider/model versioned input, cached-input and output prices by observed token counts, records EUR after an explicit conversion source, and retains the pricing-source version. Unknown pricing is reported as unavailable rather than zero. Ollama has zero API fee, but VPS cost remains in the budget ledger. The UI only aggregates backend records.
