const Matchmaking = (() => {
  let _gameId = null;
  let _pollTimer = null;
  let _isSearching = false;
  let _hasJoined = false;
  let _matchId = null;
  let _mySlot = 'player';
  let _onMatch = null;
  let _onStatus = null;
  let _onError = null;

  function _cancelApiCall() {
    if (!_gameId || !Api.hasConfiguredApiUrl()) return;
    Api.apiCasinoCancelGameMatchmaking(Auth.token(), _gameId).catch(() => {});
  }

  function _clear() {
    if (_pollTimer) { clearInterval(_pollTimer); _pollTimer = null; }
    _isSearching = false;
    _hasJoined = false;
    _gameId = null;
    _matchId = null;
    _mySlot = 'player';
  }

  async function _pollOnce() {
    if (!_isSearching || !_gameId) return;
    try {
      const result = await Api.apiCasinoJoinGameMatch(Auth.token(), _gameId);
      if (result.status === 'matched' && result.match) {
        _matchId = result.match.matchId;
        _mySlot = result.match.mySlot || 'player';
        _isSearching = false;
        if (_pollTimer) { clearInterval(_pollTimer); _pollTimer = null; }
        if (_onStatus) _onStatus('matched');
        if (_onMatch) _onMatch({ matchId: _matchId, mySlot: _mySlot });
      }
    } catch (err) {
      if (_onError) _onError(err.message);
    }
  }

  function search(gameId, callbacks = {}) {
    if (_isSearching) return;
    if (!UI.requireSession()) return;
    if (!Api.hasConfiguredApiUrl()) {
      if (callbacks.onError) callbacks.onError('Configura Apps Script para buscar rival.');
      return;
    }
    const user = Auth.user();
    if (!user) {
      if (callbacks.onError) callbacks.onError('Debes iniciar sesion.');
      return;
    }

    _gameId = gameId;
    _onMatch = callbacks.onMatch || null;
    _onStatus = callbacks.onStatus || null;
    _onError = callbacks.onError || null;
    _isSearching = true;
    _hasJoined = false;
    _matchId = null;
    _mySlot = 'player';

    if (_onStatus) _onStatus('searching');
  }

  async function connect() {
    if (!_isSearching || _hasJoined) return;
    _hasJoined = true;
    try {
      const result = await Api.apiCasinoJoinGameMatch(Auth.token(), _gameId);
      if (result.status === 'matched' && result.match) {
        _matchId = result.match.matchId;
        _mySlot = result.match.mySlot || 'player';
        _isSearching = false;
        if (_onStatus) _onStatus('matched');
        if (_onMatch) _onMatch({ matchId: _matchId, mySlot: _mySlot });
        return;
      }
      if (_onStatus) _onStatus('waiting');
      _pollTimer = setInterval(_pollOnce, 1500);
    } catch (err) {
      _hasJoined = false;
      if (_onError) _onError(err.message);
    }
  }

  function cancel() {
    const wasSearching = _isSearching;
    _clear();
    if (wasSearching) _cancelApiCall();
  }

  function leave() {
    _clear();
  }

  function isSearching() { return _isSearching; }
  function getMatchId() { return _matchId; }
  function getMySlot() { return _mySlot; }
  function getGameId() { return _gameId; }

  window.addEventListener('hashchange', () => { if (_isSearching) cancel(); });

  return { search, connect, cancel, leave, isSearching, getMatchId, getMySlot, getGameId };
})();
