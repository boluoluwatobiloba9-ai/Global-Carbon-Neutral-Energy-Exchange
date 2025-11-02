(define-constant ERR-NOT-AUTHORIZED u100)
(define-constant ERR-INVALID-AMOUNT u101)
(define-constant ERR-INVALID-PRICE u102)
(define-constant ERR-INVALID-ENERGY-TYPE u103)
(define-constant ERR-INVALID-LOCATION u104)
(define-constant ERR-INVALID-EXPIRY u105)
(define-constant ERR-OFFER-ALREADY-EXISTS u106)
(define-constant ERR-OFFER-NOT-FOUND u107)
(define-constant ERR-BID-ALREADY-EXISTS u108)
(define-constant ERR-BID-NOT-FOUND u109)
(define-constant ERR-INVALID-MATCH u110)
(define-constant ERR-TRADE-FAILED u111)
(define-constant ERR-CANCEL-NOT-ALLOWED u112)
(define-constant ERR-INVALID-STATUS u113)
(define-constant ERR-INSUFFICIENT-BALANCE u114)
(define-constant ERR-ESCROW-FAIL u115)
(define-constant ERR-AUDIT-FAIL u116)
(define-constant ERR-INVALID-MIN-PRICE u117)
(define-constant ERR-INVALID-MAX-PRICE u118)
(define-constant ERR-INVALID-PREFERRED-TYPE u119)
(define-constant ERR-INVALID-PREFERRED-LOCATION u120)
(define-constant ERR-MAX-OFFERS-EXCEEDED u121)
(define-constant ERR-MAX-BIDS-EXCEEDED u122)
(define-constant ERR-INVALID-TIMESTAMP u123)
(define-constant ERR-AUTHORITY-NOT-VERIFIED u124)
(define-constant ERR-INVALID-CURRENCY u125)
(define-data-var next-offer-id uint u0)
(define-data-var next-bid-id uint u0)
(define-data-var max-offers uint u10000)
(define-data-var max-bids uint u10000)
(define-data-var marketplace-fee uint u500)
(define-data-var authority-contract (optional principal) none)
(define-map offers
  uint
  {
    producer: principal,
    amount: uint,
    price: uint,
    energy-type: (string-utf8 50),
    location: (string-utf8 100),
    expiry: uint,
    status: bool,
    currency: (string-utf8 20)
  }
)
(define-map bids
  uint
  {
    buyer: principal,
    amount: uint,
    max-price: uint,
    preferred-type: (string-utf8 50),
    preferred-location: (string-utf8 100),
    expiry: uint,
    status: bool,
    currency: (string-utf8 20)
  }
)
(define-map offer-matches uint uint)
(define-map bid-matches uint uint)
(define-read-only (get-offer (id uint))
  (map-get? offers id)
)
(define-read-only (get-bid (id uint))
  (map-get? bids id)
)
(define-read-only (get-offer-match (offer-id uint))
  (map-get? offer-matches offer-id)
)
(define-read-only (get-bid-match (bid-id uint))
  (map-get? bid-matches bid-id)
)
(define-private (validate-amount (amount uint))
  (if (> amount u0)
      (ok true)
      (err ERR-INVALID-AMOUNT))
)
(define-private (validate-price (price uint))
  (if (> price u0)
      (ok true)
      (err ERR-INVALID-PRICE))
)
(define-private (validate-energy-type (type (string-utf8 50)))
  (if (or (is-eq type "solar") (is-eq type "wind") (is-eq type "hydro") (is-eq type "geothermal"))
      (ok true)
      (err ERR-INVALID-ENERGY-TYPE))
)
(define-private (validate-location (loc (string-utf8 100)))
  (if (and (> (len loc) u0) (<= (len loc) u100))
      (ok true)
      (err ERR-INVALID-LOCATION))
)
(define-private (validate-expiry (expiry uint))
  (if (> expiry block-height)
      (ok true)
      (err ERR-INVALID-EXPIRY))
)
(define-private (validate-currency (cur (string-utf8 20)))
  (if (or (is-eq cur "STX") (is-eq cur "USD") (is-eq cur "BTC"))
      (ok true)
      (err ERR-INVALID-CURRENCY))
)
(define-private (validate-min-price (price uint))
  (if (>= price u0)
      (ok true)
      (err ERR-INVALID-MIN-PRICE))
)
(define-private (validate-max-price (price uint))
  (if (> price u0)
      (ok true)
      (err ERR-INVALID-MAX-PRICE))
)
(define-private (validate-preferred-type (type (string-utf8 50)))
  (if (or (is-eq type "solar") (is-eq type "wind") (is-eq type "hydro") (is-eq type "geothermal") (is-eq type "any"))
      (ok true)
      (err ERR-INVALID-PREFERRED-TYPE))
)
(define-private (validate-preferred-location (loc (string-utf8 100)))
  (if (or (is-eq loc "any") (and (> (len loc) u0) (<= (len loc) u100)))
      (ok true)
      (err ERR-INVALID-PREFERRED-LOCATION))
)
(define-private (validate-principal (p principal))
  (if (not (is-eq p 'SP000000000000000000002Q6VF78))
      (ok true)
      (err ERR-NOT-AUTHORIZED))
)
(define-private (is-valid-match (offer {producer: principal, amount: uint, price: uint, energy-type: (string-utf8 50), location: (string-utf8 100), expiry: uint, status: bool, currency: (string-utf8 20)} ) (bid {buyer: principal, amount: uint, max-price: uint, preferred-type: (string-utf8 50), preferred-location: (string-utf8 100), expiry: uint, status: bool, currency: (string-utf8 20)} ))
  (and
    (get status offer)
    (get status bid)
    (>= (get amount offer) (get amount bid))
    (<= (get price offer) (get max-price bid))
    (or (is-eq (get preferred-type bid) "any") (is-eq (get energy-type offer) (get preferred-type bid)))
    (or (is-eq (get preferred-location bid) "any") (is-eq (get location offer) (get preferred-location bid)))
    (is-eq (get currency offer) (get currency bid))
    (> (get expiry offer) block-height)
    (> (get expiry bid) block-height)
  )
)
(define-public (set-authority-contract (contract-principal principal))
  (begin
    (try! (validate-principal contract-principal))
    (asserts! (is-none (var-get authority-contract)) (err ERR-AUTHORITY-NOT-VERIFIED))
    (var-set authority-contract (some contract-principal))
    (ok true)
  )
)
(define-public (set-max-offers (new-max uint))
  (begin
    (asserts! (> new-max u0) (err ERR-INVALID-AMOUNT))
    (asserts! (is-some (var-get authority-contract)) (err ERR-AUTHORITY-NOT-VERIFIED))
    (var-set max-offers new-max)
    (ok true)
  )
)
(define-public (set-max-bids (new-max uint))
  (begin
    (asserts! (> new-max u0) (err ERR-INVALID-AMOUNT))
    (asserts! (is-some (var-get authority-contract)) (err ERR-AUTHORITY-NOT-VERIFIED))
    (var-set max-bids new-max)
    (ok true)
  )
)
(define-public (set-marketplace-fee (new-fee uint))
  (begin
    (asserts! (>= new-fee u0) (err ERR-INVALID-PRICE))
    (asserts! (is-some (var-get authority-contract)) (err ERR-AUTHORITY-NOT-VERIFIED))
    (var-set marketplace-fee new-fee)
    (ok true)
  )
)
(define-public (list-offer (amount uint) (price uint) (energy-type (string-utf8 50)) (location (string-utf8 100)) (expiry uint) (currency (string-utf8 20)))
  (let (
        (next-id (var-get next-offer-id))
        (current-max (var-get max-offers))
        (authority (var-get authority-contract))
      )
    (asserts! (< next-id current-max) (err ERR-MAX-OFFERS-EXCEEDED))
    (try! (validate-amount amount))
    (try! (validate-price price))
    (try! (validate-energy-type energy-type))
    (try! (validate-location location))
    (try! (validate-expiry expiry))
    (try! (validate-currency currency))
    (asserts! (is-some authority) (err ERR-AUTHORITY-NOT-VERIFIED))
    (map-set offers next-id
      {
        producer: tx-sender,
        amount: amount,
        price: price,
        energy-type: energy-type,
        location: location,
        expiry: expiry,
        status: true,
        currency: currency
      }
    )
    (var-set next-offer-id (+ next-id u1))
    (print { event: "offer-listed", id: next-id })
    (ok next-id)
  )
)
(define-public (create-bid (amount uint) (max-price uint) (preferred-type (string-utf8 50)) (preferred-location (string-utf8 100)) (expiry uint) (currency (string-utf8 20)))
  (let (
        (next-id (var-get next-bid-id))
        (current-max (var-get max-bids))
        (authority (var-get authority-contract))
      )
    (asserts! (< next-id current-max) (err ERR-MAX-BIDS-EXCEEDED))
    (try! (validate-amount amount))
    (try! (validate-max-price max-price))
    (try! (validate-preferred-type preferred-type))
    (try! (validate-preferred-location preferred-location))
    (try! (validate-expiry expiry))
    (try! (validate-currency currency))
    (asserts! (is-some authority) (err ERR-AUTHORITY-NOT-VERIFIED))
    (map-set bids next-id
      {
        buyer: tx-sender,
        amount: amount,
        max-price: max-price,
        preferred-type: preferred-type,
        preferred-location: preferred-location,
        expiry: expiry,
        status: true,
        currency: currency
      }
    )
    (var-set next-bid-id (+ next-id u1))
    (print { event: "bid-created", id: next-id })
    (ok next-id)
  )
)
(define-public (match-order (offer-id uint) (bid-id uint))
  (let ((offer-opt (map-get? offers offer-id)) (bid-opt (map-get? bids bid-id)))
    (match offer-opt offer
      (match bid-opt bid
        (begin
          (asserts! (is-valid-match offer bid) (err ERR-INVALID-MATCH))
          (asserts! (is-none (map-get? offer-matches offer-id)) (err ERR-OFFER-ALREADY-EXISTS))
          (asserts! (is-none (map-get? bid-matches bid-id)) (err ERR-BID-ALREADY-EXISTS))
          (map-set offer-matches offer-id bid-id)
          (map-set bid-matches bid-id offer-id)
          (print { event: "order-matched", offer-id: offer-id, bid-id: bid-id })
          (ok true)
        )
        (err ERR-BID-NOT-FOUND)
      )
      (err ERR-OFFER-NOT-FOUND)
    )
  )
)
(define-public (execute-trade (offer-id uint) (bid-id uint))
  (let ((offer-opt (map-get? offers offer-id)) (bid-opt (map-get? bids bid-id)))
    (match offer-opt offer
      (match bid-opt bid
        (begin
          (asserts! (is-eq (unwrap! (map-get? offer-matches offer-id) (err ERR-INVALID-MATCH)) bid-id) (err ERR-INVALID-MATCH))
          (asserts! (is-valid-match offer bid) (err ERR-INVALID-MATCH))
          (let ((trade-amount (get amount bid)) (trade-price (get price offer)) (producer (get producer offer)) (buyer (get buyer bid)) (currency (get currency offer)))
            (map-set offers offer-id (merge offer { status: false }))
            (map-set bids bid-id (merge bid { status: false }))
            (map-delete offer-matches offer-id)
            (map-delete bid-matches bid-id)
            (print { event: "trade-executed", offer-id: offer-id, bid-id: bid-id, amount: trade-amount, price: trade-price })
            (ok true)
          )
        )
        (err ERR-BID-NOT-FOUND)
      )
      (err ERR-OFFER-NOT-FOUND)
    )
  )
)
(define-public (cancel-offer (offer-id uint))
  (let ((offer-opt (map-get? offers offer-id)))
    (match offer-opt offer
      (begin
        (asserts! (is-eq (get producer offer) tx-sender) (err ERR-NOT-AUTHORIZED))
        (asserts! (get status offer) (err ERR-INVALID-STATUS))
        (asserts! (is-none (map-get? offer-matches offer-id)) (err ERR-CANCEL-NOT-ALLOWED))
        (map-set offers offer-id (merge offer { status: false }))
        (print { event: "offer-cancelled", id: offer-id })
        (ok true)
      )
      (err ERR-OFFER-NOT-FOUND)
    )
  )
)
(define-public (cancel-bid (bid-id uint))
  (let ((bid-opt (map-get? bids bid-id)))
    (match bid-opt bid
      (begin
        (asserts! (is-eq (get buyer bid) tx-sender) (err ERR-NOT-AUTHORIZED))
        (asserts! (get status bid) (err ERR-INVALID-STATUS))
        (asserts! (is-none (map-get? bid-matches bid-id)) (err ERR-CANCEL-NOT-ALLOWED))
        (map-set bids bid-id (merge bid { status: false }))
        (print { event: "bid-cancelled", id: bid-id })
        (ok true)
      )
      (err ERR-BID-NOT-FOUND)
    )
  )
)
(define-public (get-active-offers)
  ;; Returns the list of active offer IDs.
  ;; NOTE: simplified to avoid recursive helper for now. Implementing a full
  ;; iterator would require maintaining an index list or a different pattern.
  (list)
)

(define-public (get-active-bids)
  ;; Returns the list of active bid IDs.
  ;; NOTE: simplified to avoid recursive helper for now.
  (list)
)