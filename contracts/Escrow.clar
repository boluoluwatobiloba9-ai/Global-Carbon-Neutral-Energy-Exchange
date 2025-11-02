;; Escrow.clar
(define-constant ERR-NOT-AUTHORIZED u100)
(define-constant ERR-INVALID-AMOUNT u101)
(define-constant ERR-INVALID-STATE u102)
(define-constant ERR-ESCROW-NOT-FOUND u103)
(define-constant ERR-ESCROW-EXPIRED u104)
(define-constant ERR-ESCROW-NOT-EXPIRED u105)
(define-constant ERR-INSUFFICIENT-BALANCE u106)
(define-constant ERR-TOKEN-TRANSFER-FAILED u107)
(define-constant ERR-STX-TRANSFER-FAILED u108)
(define-constant ERR-INVALID-CURRENCY u109)
(define-constant ERR-DISPUTE-NOT-ALLOWED u110)
(define-constant ERR-ALREADY-RESOLVED u111)
(define-constant ERR-INVALID-PARTY u112)
(define-constant ERR-ESCROW-CANCELLED u113)
(define-data-var next-escrow-id uint u0)
(define-data-var dispute-authority (optional principal) none)
(define-map escrows
  uint
  {
    offer-id: uint,
    bid-id: uint,
    producer: principal,
    buyer: principal,
    amount: uint,
    price: uint,
    currency: (string-utf8 20),
    status: (string-ascii 20),
    created-at: uint,
    expires-at: uint,
    token-lock-id: (optional uint)
  }
)
(define-map escrow-balances uint uint)
(define-read-only (get-escrow (escrow-id uint))
  (map-get? escrows escrow-id)
)
(define-read-only (get-escrow-balance (escrow-id uint))
  (default-to u0 (map-get? escrow-balances escrow-id))
)
(define-read-only (get-dispute-authority)
  (var-get dispute-authority)
)
(define-private (validate-amount (amount uint))
  (if (> amount u0)
      (ok true)
      (err ERR-INVALID-AMOUNT))
)
(define-private (validate-currency (cur (string-utf8 20)))
  (if (or (is-eq cur "STX") (is-eq cur "USD") (is-eq cur "BTC"))
      (ok true)
      (err ERR-INVALID-CURRENCY))
)
(define-private (validate-principal (p principal))
  (if (not (is-eq p 'SP000000000000000000002Q6VF78))
      (ok true)
      (err ERR-NOT-AUTHORIZED))
)
(define-public (set-dispute-authority (authority principal))
  (begin
    (try! (validate-principal authority))
    (asserts! (is-none (var-get dispute-authority)) (err ERR-NOT-AUTHORIZED))
    (var-set dispute-authority (some authority))
    (ok true)
  )
)
(define-public (initiate-escrow (offer-id uint) (bid-id uint) (amount uint) (price uint) (currency (string-utf8 20)) (expires-in uint) (token-lock-id (optional uint)))
  (let (
        (escrow-id (var-get next-escrow-id))
        (total-price (* amount price))
        (expires-at (+ block-height expires-in))
      )
    (try! (validate-amount amount))
    (try! (validate-amount price))
    (try! (validate-currency currency))
    (asserts! (> expires-in u0) (err ERR-INVALID-AMOUNT))
    (if (is-eq currency "STX")
        (try! (stx-transfer? total-price tx-sender (as-contract tx-sender)))
        (ok true)
    )
    (map-set escrows escrow-id
      {
        offer-id: offer-id,
        bid-id: bid-id,
  producer: (contract-call? .Marketplace get-offer offer-id), ;; mocked in test
        buyer: tx-sender,
        amount: amount,
        price: price,
        currency: currency,
        status: "active",
        created-at: block-height,
        expires-at: expires-at,
        token-lock-id: token-lock-id
      }
    )
    (map-set escrow-balances escrow-id total-price)
    (var-set next-escrow-id (+ escrow-id u1))
    (print {event: "escrow-initiated", escrow-id: escrow-id, amount: amount, total: total-price})
    (ok escrow-id)
  )
)
(define-public (release-escrow (escrow-id uint))
  (let ((escrow-opt (map-get? escrows escrow-id)))
    (match escrow-opt escrow
      (begin
        (asserts! (or (is-eq tx-sender (get producer escrow)) (is-eq tx-sender (get buyer escrow))) (err ERR-NOT-AUTHORIZED))
        (asserts! (is-eq (get status escrow) "active") (err ERR-INVALID-STATE))
        (asserts! (<= block-height (get expires-at escrow)) (err ERR-ESCROW-EXPIRED))
        (let ((total (unwrap! (map-get? escrow-balances escrow-id) (err ERR-ESCROW-NOT-FOUND))))
          (map-set escrows escrow-id (merge escrow {status: "released"}))
          (map-delete escrow-balances escrow-id)
          (if (is-eq (get currency escrow) "STX")
              (try! (as-contract (stx-transfer? total tx-sender (get producer escrow))))
              (ok true)
          )
          (print {event: "escrow-released", escrow-id: escrow-id, to: (get producer escrow)})
          (ok true)
        )
      )
      (err ERR-ESCROW-NOT-FOUND)
    )
  )
)
(define-public (refund-escrow (escrow-id uint))
  (let ((escrow-opt (map-get? escrows escrow-id)))
    (match escrow-opt escrow
      (begin
        (asserts! (is-eq tx-sender (get buyer escrow)) (err ERR-NOT-AUTHORIZED))
        (asserts! (is-eq (get status escrow) "active") (err ERR-INVALID-STATE))
        (asserts! (> block-height (get expires-at escrow)) (err ERR-ESCROW-NOT-EXPIRED))
        (let ((total (unwrap! (map-get? escrow-balances escrow-id) (err ERR-ESCROW-NOT-FOUND))))
          (map-set escrows escrow-id (merge escrow {status: "refunded"}))
          (map-delete escrow-balances escrow-id)
          (try! (as-contract (stx-transfer? total tx-sender (get buyer escrow))))
          (print {event: "escrow-refunded", escrow-id: escrow-id, to: (get buyer escrow)})
          (ok true)
        )
      )
      (err ERR-ESCROW-NOT-FOUND)
    )
  )
)
(define-public (raise-dispute (escrow-id uint))
  (let ((escrow-opt (map-get? escrows escrow-id)))
    (match escrow-opt escrow
      (begin
        (asserts! (or (is-eq tx-sender (get producer escrow)) (is-eq tx-sender (get buyer escrow))) (err ERR-NOT-AUTHORIZED))
        (asserts! (is-eq (get status escrow) "active") (err ERR-INVALID-STATE))
        (asserts! (is-some (var-get dispute-authority)) (err ERR-NOT-AUTHORIZED))
        (map-set escrows escrow-id (merge escrow {status: "disputed"}))
        (print {event: "escrow-disputed", escrow-id: escrow-id, by: tx-sender})
        (ok true)
      )
      (err ERR-ESCROW-NOT-FOUND)
    )
  )
)
(define-public (resolve-dispute (escrow-id uint) (release-to-producer bool))
  (let ((escrow-opt (map-get? escrows escrow-id)))
    (match escrow-opt escrow
      (begin
        (asserts! (is-eq tx-sender (unwrap! (var-get dispute-authority) (err ERR-NOT-AUTHORIZED))) (err ERR-NOT-AUTHORIZED))
        (asserts! (is-eq (get status escrow) "disputed") (err ERR-INVALID-STATE))
        (let ((total (unwrap! (map-get? escrow-balances escrow-id) (err ERR-ESCROW-NOT-FOUND)))
              (recipient (if release-to-producer (get producer escrow) (get buyer escrow))))
          (map-set escrows escrow-id (merge escrow {status: (if release-to-producer "released" "refunded")}))
          (map-delete escrow-balances escrow-id)
          (if (is-eq (get currency escrow) "STX")
              (try! (as-contract (stx-transfer? total tx-sender recipient)))
              (ok true)
          )
          (print {event: "dispute-resolved", escrow-id: escrow-id, to: recipient, by-authority: true})
          (ok true)
        )
      )
      (err ERR-ESCROW-NOT-FOUND)
    )
  )
)
(define-public (cancel-escrow (escrow-id uint))
  (let ((escrow-opt (map-get? escrows escrow-id)))
    (match escrow-opt escrow
      (begin
        (asserts! (is-eq tx-sender (get buyer escrow)) (err ERR-NOT-AUTHORIZED))
        (asserts! (is-eq (get status escrow) "active") (err ERR-INVALID-STATE))
        (asserts! (> block-height (get expires-at escrow)) (err ERR-ESCROW-NOT-EXPIRED))
        (let ((total (unwrap! (map-get? escrow-balances escrow-id) (err ERR-ESCROW-NOT-FOUND))))
          (map-set escrows escrow-id (merge escrow {status: "cancelled"}))
          (map-delete escrow-balances escrow-id)
          (try! (as-contract (stx-transfer? total tx-sender (get buyer escrow))))
          (print {event: "escrow-cancelled", escrow-id: escrow-id})
          (ok true)
        )
      )
      (err ERR-ESCROW-NOT-FOUND)
    )
  )
)