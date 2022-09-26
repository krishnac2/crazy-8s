import React, { useEffect, useState } from 'react'
import PACK_OF_CARDS from '../utils/packOfCards'
import shuffleArray from '../utils/shuffleArray'
import io from 'socket.io-client'
import queryString from 'query-string'
import Spinner from './Spinner'
import useSound from 'use-sound'

import bgMusic from '../assets/sounds/game-bg-music.mp3'
import shufflingSound from '../assets/sounds/shuffling-cards-1.mp3'
import wildCardSound from '../assets/sounds/wild-sound.mp3'
import gameOverSound from '../assets/sounds/game-over-sound.mp3'

//number code for 8 is 300 because it's an action card

let socket
const ENDPOINT = 'http://localhost:5000'

const Game = (props) => {
    const data = queryString.parse(props.location.search)

    //initialize socket state
    const [room, setRoom] = useState(data.roomCode)
    const [roomFull, setRoomFull] = useState(false)
    const [users, setUsers] = useState([])
    const [currentUser, setCurrentUser] = useState('')
    const [message, setMessage] = useState('')
    const [messages, setMessages] = useState([])

    useEffect(() => {
        const connectionOptions =  {
            "forceNew" : true,
            "reconnectionAttempts": "Infinity", 
            "timeout" : 10000,                  
            "transports" : ["websocket"]
        }
        socket = io.connect(ENDPOINT, connectionOptions)

        socket.emit('join', {room: room}, (error) => {
            if(error)
                setRoomFull(true)
        })

        //cleanup on component unmount
        return function cleanup() {
            socket.emit('disconnect')
            //shut down connnection instance
            socket.off()
        }
    }, [])

    //initialize game state
    const [gameOver, setGameOver] = useState(true)
    const [winner, setWinner] = useState('')
    const [turn, setTurn] = useState('')
    const [player1Deck, setPlayer1Deck] = useState([])
    const [player2Deck, setPlayer2Deck] = useState([])
    const [currentSuit, setCurrentSuit] = useState('')
    const [currentNumber, setCurrentNumber] = useState('')
    const [playedCardsPile, setPlayedCardsPile] = useState([])
    const [drawCardPile, setDrawCardPile] = useState([])

    const [isChatBoxHidden, setChatBoxHidden] = useState(true)
    const [isSoundMuted, setSoundMuted] = useState(false)
    const [isMusicMuted, setMusicMuted] = useState(true)

    const [playBBgMusic, { pause }] = useSound(bgMusic, { loop: true })
    const [playShufflingSound] = useSound(shufflingSound)
    const [playWildCardSound] = useSound(wildCardSound)
    const [playGameOverSound] = useSound(gameOverSound)

    //runs once on component mount
    useEffect(() => {
        //shuffle PACK_OF_CARDS array
        const shuffledCards = shuffleArray(PACK_OF_CARDS)

        //extract first 7 elements to player1Deck
        const player1Deck = shuffledCards.splice(0, 7)

        //extract first 7 elements to player2Deck
        const player2Deck = shuffledCards.splice(0, 7)

        //extract random card from shuffledCards and check if its not an 8
        let startingCardIndex
        while(true) {
            startingCardIndex = Math.floor(Math.random() * 40)
            if(shuffledCards[startingCardIndex]==='8c' || shuffledCards[startingCardIndex]==='8d' || shuffledCards[startingCardIndex]==='8h' ||
            shuffledCards[startingCardIndex]==='8s') {
                continue;
            }
            else
                break;
        }

        //extract the card from that startingCardIndex into the playedCardsPile
        const playedCardsPile = shuffledCards.splice(startingCardIndex, 1)

        //store all remaining cards into drawCardPile
        const drawCardPile = shuffledCards

        //send initial state to server
        socket.emit('initGameState', {
            gameOver: false,
            turn: 'Player 1',
            player1Deck: [...player1Deck],
            player2Deck: [...player2Deck],
            currentSuit: playedCardsPile[0].charAt(1),
            currentNumber: playedCardsPile[0].charAt(0),
            playedCardsPile: [...playedCardsPile],
            drawCardPile: [...drawCardPile]
        })
    }, [])

    useEffect(() => {
        socket.on('initGameState', ({ gameOver, turn, player1Deck, player2Deck, currentSuit, currentNumber, playedCardsPile, drawCardPile }) => {
            setGameOver(gameOver)
            setTurn(turn)
            setPlayer1Deck(player1Deck)
            setPlayer2Deck(player2Deck)
            setCurrentSuit(currentSuit)
            setCurrentNumber(currentNumber)
            setPlayedCardsPile(playedCardsPile)
            setDrawCardPile(drawCardPile)
        })

        socket.on('updateGameState', ({ gameOver, winner, turn, player1Deck, player2Deck, currentSuit, currentNumber, playedCardsPile, drawCardPile }) => {
            gameOver && setGameOver(gameOver)
            gameOver===true && playGameOverSound()
            winner && setWinner(winner)
            turn && setTurn(turn)
            player1Deck && setPlayer1Deck(player1Deck)
            player2Deck && setPlayer2Deck(player2Deck)
            currentSuit && setCurrentSuit(currentSuit)
            currentNumber && setCurrentNumber(currentNumber)
            playedCardsPile && setPlayedCardsPile(playedCardsPile)
            drawCardPile && setDrawCardPile(drawCardPile)
        })

        socket.on("roomData", ({ users }) => {
            setUsers(users)
        })

        socket.on('currentUserData', ({ name }) => {
            setCurrentUser(name)
        })

        socket.on('message', message => {
            setMessages(messages => [ ...messages, message ])

            const chatBody = document.querySelector('.chat-body')
            chatBody.scrollTop = chatBody.scrollHeight
        })
    }, [])

    //some util functions
    const checkGameOver = (arr) => {
        return arr.length === 1
    }
    
    const checkWinner = (arr, player) => {
        return arr.length === 1 ? player : ''
    }

    const toggleChatBox = () => {
        const chatBody = document.querySelector('.chat-body')
        if(isChatBoxHidden) {
            chatBody.style.display = 'block'
            setChatBoxHidden(false)
        }
        else {
            chatBody.style.display = 'none'
            setChatBoxHidden(true)
        }
    }

    const sendMessage= (event) => {
        event.preventDefault()
        if(message) {
            socket.emit('sendMessage', { message: message }, () => {
                setMessage('')
            })
        }
    }

    //driver functions
    const onCardPlayedHandler = (played_card) => {
        //extract player who played the card
        const cardPlayedBy = turn
        switch(played_card) {
            //if card played was a number card
            case '2c': case '2d': case '2h': case '2s': case '3c': case '3d': case '3h': case '3s': case '4c': case '4d': case '4h': case '4s': case '5c': case '5d': case '5h': case '5s': case '6c': case '6d': case '6h': case '6s': case '7c': case '7d': case '7h': case '7s': case '9c': case '9d': case '9h': case '9s': case '1c': case '1d': case '1h': case '1s': case 'ac': case 'ad': case 'ah': case 'as': case 'jc': case 'jd': case 'jh': case 'js': case 'qc': case 'qd': case 'qh': case 'qs': case 'kc': case 'kd': case 'kh': case 'ks': {
                //extract number and suit of played card
                const numberOfPlayedCard = played_card.charAt(0)
                const suitOfPlayedCard = played_card.charAt(1)
                //check for suit match
                if(currentSuit === suitOfPlayedCard) {
                    console.log('suits matched!')
                    //check who played the card and return new state accordingly
                    if(cardPlayedBy === 'Player 1') {
                        //remove the played card from player1's deck and add it to playedCardsPile (immutably)
                        //then update turn, currentSuit and currentNumber
                        const removeIndex = player1Deck.indexOf(played_card)                       
                        
                        !isSoundMuted && playShufflingSound()
                        //send new state to server
                        socket.emit('updateGameState', {
                            gameOver: checkGameOver(player1Deck),
                            winner: checkWinner(player1Deck, 'Player 1'),
                            turn: 'Player 2',
                            playedCardsPile: [...playedCardsPile.slice(0, playedCardsPile.length), played_card, ...playedCardsPile.slice(playedCardsPile.length)],
                            player1Deck: [...player1Deck.slice(0, removeIndex), ...player1Deck.slice(removeIndex + 1)],
                            currentSuit: suitOfPlayedCard,
                            currentNumber: numberOfPlayedCard
                        })
                        
                    }
                    else {
                        //remove the played card from player2's deck and add it to playedCardsPile (immutably)
                        //then update turn, currentSuit and currentNumber
                        const removeIndex = player2Deck.indexOf(played_card)
                        
                        !isSoundMuted && playShufflingSound()
                        //send new state to server
                        socket.emit('updateGameState', {
                            gameOver: checkGameOver(player2Deck),
                            winner: checkWinner(player2Deck, 'Player 2'),
                            turn: 'Player 1',
                            playedCardsPile: [...playedCardsPile.slice(0, playedCardsPile.length), played_card, ...playedCardsPile.slice(playedCardsPile.length)],
                            player2Deck: [...player2Deck.slice(0, removeIndex), ...player2Deck.slice(removeIndex + 1)],
                            currentSuit: suitOfPlayedCard,
                            currentNumber: numberOfPlayedCard
                        })
                        
                    }
                }
                //check for number match
                else if(currentNumber === numberOfPlayedCard) {
                    console.log('numbers matched!')
                    //check who played the card and return new state accordingly
                    if(cardPlayedBy === 'Player 1') {
                        //remove the played card from player1's deck and add it to playedCardsPile (immutably)
                        //then update turn, currentSuit and currentNumber
                        const removeIndex = player1Deck.indexOf(played_card)
                        
                        
                         
                        !isSoundMuted && playShufflingSound()
                        //send new state to server
                        socket.emit('updateGameState', {
                            gameOver: checkGameOver(player1Deck),
                            winner: checkWinner(player1Deck, 'Player 1'),
                            turn: 'Player 2',
                            playedCardsPile: [...playedCardsPile.slice(0, playedCardsPile.length), played_card, ...playedCardsPile.slice(playedCardsPile.length)],
                            player1Deck: [...player1Deck.slice(0, removeIndex), ...player1Deck.slice(removeIndex + 1)],
                            currentSuit: suitOfPlayedCard,
                            currentNumber: numberOfPlayedCard
                        })
                        
                    }
                    else {
                        //remove the played card from player2's deck and add it to playedCardsPile (immutably)
                        //then update turn, currentSuit and currentNumber
                        const removeIndex = player2Deck.indexOf(played_card)
                        
                        
                        !isSoundMuted && playShufflingSound()
                        //send new state to server
                        socket.emit('updateGameState', {
                            gameOver: checkGameOver(player2Deck),
                            winner: checkWinner(player2Deck, 'Player 2'),
                            turn: 'Player 1',
                            playedCardsPile: [...playedCardsPile.slice(0, playedCardsPile.length), played_card, ...playedCardsPile.slice(playedCardsPile.length)],
                            player2Deck: [...player2Deck.slice(0, removeIndex), ...player2Deck.slice(removeIndex + 1)],
                            currentSuit: suitOfPlayedCard,
                            currentNumber: numberOfPlayedCard
                        })
                        
                    }
                }
                //if no suit or number match, invalid move - do not update state
                else {
                    alert('Invalid Move!')
                }
                break;
            }
            //if card played was a 8 card
            case '8c': case '8d': case '8h': case '8s': {
                //check who played the card and return new state accordingly
                if(cardPlayedBy === 'Player 1') {
                    //ask for new suit
                    const newSuit = prompt('Enter the first letter of the new suit (c for Clubs/d for Diamonds/h for Hearts/s for Spades)').toLowerCase()
                    //remove the played card from player1's deck and add it to playedCardsPile (immutably)
                    const removeIndex = player1Deck.indexOf(played_card)
                    //then update turn, currentSuit and currentNumber
                    
                    
                    !isSoundMuted && playWildCardSound()
                    //send new state to server
                    socket.emit('updateGameState', {
                        gameOver: checkGameOver(player1Deck),
                        winner: checkWinner(player1Deck, 'Player 1'),
                        turn: 'Player 2',
                        playedCardsPile: [...playedCardsPile.slice(0, playedCardsPile.length), played_card, ...playedCardsPile.slice(playedCardsPile.length)],
                        player1Deck: [...player1Deck.slice(0, removeIndex), ...player1Deck.slice(removeIndex + 1)],
                        currentSuit: newSuit,
                        currentNumber: 300
                    })
                    
                }
                else {
                    //ask for new suit
                    const newSuit = prompt('Enter the first letter of the new suit (c for Clubs/d for Diamonds/h for Hearts/s for Spades)').toLowerCase()
                    //remove the played card from player2's deck and add it to playedCardsPile (immutably)
                    const removeIndex = player2Deck.indexOf(played_card)
                    //then update turn, currentSuit and currentNumber
                    
                    !isSoundMuted && playWildCardSound()
                    //send new state to server
                    socket.emit('updateGameState', {
                        gameOver: checkGameOver(player2Deck),
                        winner: checkWinner(player2Deck, 'Player 2'),
                        turn: 'Player 1',
                        playedCardsPile: [...playedCardsPile.slice(0, playedCardsPile.length), played_card, ...playedCardsPile.slice(playedCardsPile.length)],
                        player2Deck: [...player2Deck.slice(0, removeIndex), ...player2Deck.slice(removeIndex + 1)],
                        currentSuit: newSuit,
                        currentNumber: 300
                    })
                    
                }
                break;
            }
            break;
        }
    }
    
    const onCardDrawnHandler = () => {
        //extract player who drew the card
        const cardDrawnBy = turn
        let suitName = " ";
        let numName = " ";
        let cardName = " ";
        //check who drew the card and return new state accordingly
        if(cardDrawnBy === 'Player 1') {
            //remove 1 new card from drawCardPile and add it to player1's deck (immutably)
            //make a copy of drawCardPile array
            const copiedDrawCardPileArray = [...drawCardPile]
            //pull out last element from it
            const drawCard = copiedDrawCardPileArray.pop()
            //extract number and suit of drawn card
            const suitOfDrawnCard = drawCard.charAt(drawCard.length - 1)
            let numberOfDrawnCard = drawCard.charAt(0)
            if(drawCard === '8c' || drawCard === '8d' || drawCard === '8h' || drawCard === '8s') {
                if (suitOfDrawnCard === 'c') {
                    suitName = "Clubs";
                }
                if (suitOfDrawnCard === 'd') {
                    suitName = "Diamonds";
                }
                if (suitOfDrawnCard === 'h') {
                    suitName = "Hearts";
                }
                if (suitOfDrawnCard === 's') {
                    suitName = "Spades";
                }
                numName = numberOfDrawnCard
                cardName = numName + " of " + suitName;
                alert(`You drew ${cardName}. It was played for you.`)
                //ask for new suit
                const newSuit = prompt('Enter the first letter of the new suit (c for Clubs/d for Diamonds/h for Hearts/s for Spades)').toLowerCase()
                !isSoundMuted && playWildCardSound()
                //send new state to server
                socket.emit('updateGameState', {
                    turn: 'Player 2',
                    playedCardsPile: [...playedCardsPile.slice(0, playedCardsPile.length), drawCard, ...playedCardsPile.slice(playedCardsPile.length)],
                    currentSuit: newSuit,
                    currentNumber: 300,
                    drawCardPile: [...copiedDrawCardPileArray]
                })
            }
            //if not 8 card - check if drawn card is playable
            else if(numberOfDrawnCard === currentNumber || suitOfDrawnCard === currentSuit) {
                if (suitOfDrawnCard === 'c') {
                    suitName = "Clubs";
                }
                if (suitOfDrawnCard === 'd') {
                    suitName = "Diamonds";
                }
                if (suitOfDrawnCard === 'h') {
                    suitName = "Hearts";
                }
                if (suitOfDrawnCard === 's') {
                    suitName = "Spades";
                }

                if (numberOfDrawnCard === '1') {
                    numName = '10';
                }
                else if (numberOfDrawnCard === 'a') {
                    numName = 'Ace';
                }
                else if (numberOfDrawnCard === 'j') {
                    numName = 'Jack';
                }
                else if (numberOfDrawnCard === 'q') {
                    numName = 'Queen';
                }
                else if (numberOfDrawnCard === 'k') {
                    numName = 'King';
                }
                else {
                    numName = numberOfDrawnCard
                }
                cardName = numName + " of " + suitName;
                alert(`You drew ${cardName}. It was played for you.`)
                !isSoundMuted && playShufflingSound()
                //send new state to server
                socket.emit('updateGameState', {
                    turn: 'Player 2',
                    playedCardsPile: [...playedCardsPile.slice(0, playedCardsPile.length), drawCard, ...playedCardsPile.slice(playedCardsPile.length)],
                    currentSuit: suitOfDrawnCard,
                    currentNumber: numberOfDrawnCard,
                    drawCardPile: [...copiedDrawCardPileArray]
                })
            }
            //else add the drawn card to player1's deck
            else {
                !isSoundMuted && playShufflingSound()
                //send new state to server
                socket.emit('updateGameState', {
                    turn: 'Player 2',
                    player1Deck: [...player1Deck.slice(0, player1Deck.length), drawCard, ...player1Deck.slice(player1Deck.length)],
                    drawCardPile: [...copiedDrawCardPileArray]
                })
            }
        }
        else {
            //remove 1 new card from drawCardPile and add it to player2's deck (immutably)
            //make a copy of drawCardPile array
            const copiedDrawCardPileArray = [...drawCardPile]
            //pull out last element from it
            const drawCard = copiedDrawCardPileArray.pop()
            //extract number and suit of drawn card
            const suitOfDrawnCard = drawCard.charAt(drawCard.length - 1)
            let numberOfDrawnCard = drawCard.charAt(0)
            if(drawCard === '8c' || drawCard === '8d' || drawCard === '8h' || drawCard === '8s') {
                if (suitOfDrawnCard === 'c') {
                    suitName = "Clubs";
                }
                if (suitOfDrawnCard === 'd') {
                    suitName = "Diamonds";
                }
                if (suitOfDrawnCard === 'h') {
                    suitName = "Hearts";
                }
                if (suitOfDrawnCard === 's') {
                    suitName = "Spades";
                }

                numName = numberOfDrawnCard
                cardName = numName + " of " + suitName;
                alert(`You drew ${cardName}. It was played for you.`)
                //ask for new suit
                const newSuit = prompt('Enter the first letter of the new suit (c for Clubs/d for Diamonds/h for Hearts/s for Spades)').toLowerCase()
                !isSoundMuted && playWildCardSound()
                //send new state to server
                socket.emit('updateGameState', {
                    turn: 'Player 1',
                    playedCardsPile: [...playedCardsPile.slice(0, playedCardsPile.length), drawCard, ...playedCardsPile.slice(playedCardsPile.length)],
                    currentSuit: newSuit,
                    currentNumber: 300,
                    drawCardPile: [...copiedDrawCardPileArray]
                })
            }
            //if not 8 card - check if drawn card is playable
            else if(numberOfDrawnCard === currentNumber || suitOfDrawnCard === currentSuit) {
                if (suitOfDrawnCard === 'c') {
                    suitName = "Clubs";
                }
                if (suitOfDrawnCard === 'd') {
                    suitName = "Diamonds";
                }
                if (suitOfDrawnCard === 'h') {
                    suitName = "Hearts";
                }
                if (suitOfDrawnCard === 's') {
                    suitName = "Spades";
                }

                if (numberOfDrawnCard === '1') {
                    numName = '10';
                }
                else if (numberOfDrawnCard === 'a') {
                    numName = 'Ace';
                }
                else if (numberOfDrawnCard === 'j') {
                    numName = 'Jack';
                }
                else if (numberOfDrawnCard === 'q') {
                    numName = 'Queen';
                }
                else if (numberOfDrawnCard === 'k') {
                    numName = 'King';
                }
                else {
                    numName = numberOfDrawnCard
                }
                cardName = numName + " of " + suitName;
                alert(`You drew ${cardName}. It was played for you.`)
                !isSoundMuted && playShufflingSound()
                //send new state to server
                socket.emit('updateGameState', {
                    turn: 'Player 1',
                    playedCardsPile: [...playedCardsPile.slice(0, playedCardsPile.length), drawCard, ...playedCardsPile.slice(playedCardsPile.length)],
                    currentSuit: suitOfDrawnCard,
                    currentNumber: numberOfDrawnCard,
                    drawCardPile: [...copiedDrawCardPileArray]
                })
            }
            //else add the drawn card to player2's deck
            else {
                !isSoundMuted && playShufflingSound()
                //send new state to server
                socket.emit('updateGameState', {
                    turn: 'Player 1',
                    player2Deck: [...player2Deck.slice(0, player2Deck.length), drawCard, ...player2Deck.slice(player2Deck.length)],
                    drawCardPile: [...copiedDrawCardPileArray]
                })
            }
        }
    }
    
    return (
        <div className={`Game backgroundSuitc backgroundSuit${currentSuit}`}>
            {(!roomFull) ? <>

                <div className='topInfo'>
                    <img src={require('../assets/logo.png').default} />
                    <h1>Game Code: {room}</h1>
                    <span>
                        <button className='game-button green' onClick={() => setSoundMuted(!isSoundMuted)}>{isSoundMuted ? <span className="material-icons">volume_off</span> : <span className="material-icons">volume_up</span>}</button>
                        <button className='game-button green' onClick={() => {
                            if(isMusicMuted)
                                playBBgMusic()
                            else
                                pause()
                            setMusicMuted(!isMusicMuted)
                        }}>{isMusicMuted ? <span className="material-icons">music_off</span> : <span className="material-icons">music_note</span>}</button>
                    </span>
                </div>

                {/* PLAYER LEFT MESSAGES */}
                {users.length===1 && currentUser === 'Player 2' && <h1 className='topInfoText'>Player 1 has left the game.</h1> }
                {users.length===1 && currentUser === 'Player 1' && <h1 className='topInfoText'>Waiting for Player 2 to join the game.</h1> }          

                {users.length===2 && <>

                    {gameOver ? <div>{winner !== '' && <><h1>GAME OVER</h1><h2>{winner} wins!</h2></>}</div> :
                    <div>
                        {/* PLAYER 1 VIEW */}
                        {currentUser === 'Player 1' && <>    
                        <div className='player2Deck' style={{pointerEvents: 'none'}}>
                            <p className='playerDeckText'>Player 2</p>
                            {player2Deck.map((item, i) => (
                                <img
                                    key={i}
                                    className='Card'
                                    onClick={() => onCardPlayedHandler(item)}
                                    src={require(`../assets/card-back.png`).default}
                                    />
                            ))}
                            {turn==='Player 2' && <Spinner />}
                        </div>
                        <br />
                        <div className='middleInfo' style={turn === 'Player 2' ? {pointerEvents: 'none'} : null}>
                            <button className='game-button red' disabled={turn !== 'Player 1'} onClick={onCardDrawnHandler}>DRAW CARD</button>
                            {playedCardsPile && playedCardsPile.length>0 &&
                            <img
                                className='Card'
                                src={require(`../assets/cards-front/${playedCardsPile[playedCardsPile.length-1]}.png`).default}
                                /> }
                            
                        </div>
                        
                        <br />
                        <div className='player1Deck' style={turn === 'Player 1' ? null : {pointerEvents: 'none'}}>
                            <p className='playerDeckText'>Player 1</p>
                            {player1Deck.map((item, i) => (
                                <img
                                    key={i}
                                    className='Card'
                                    onClick={() => onCardPlayedHandler(item)}
                                    src={require(`../assets/cards-front/${item}.png`).default}
                                    />
                            ))}
                        </div>
                        <div className="chatBoxWrapper">
                            <div className="chat-box chat-box-player1">
                                <div className="chat-head">
                                    <h2>Chat Box</h2>
                                    {!isChatBoxHidden ?
                                    <span onClick={toggleChatBox} class="material-icons">keyboard_arrow_down</span> :
                                    <span onClick={toggleChatBox} class="material-icons">keyboard_arrow_up</span>}
                                </div>
                                <div className="chat-body">
                                    <div className="msg-insert">
                                        {messages.map(msg => {
                                            if(msg.user === 'Player 2')
                                                return <div className="msg-receive">{msg.text}</div>
                                            if(msg.user === 'Player 1')
                                                return <div className="msg-send">{msg.text}</div>
                                        })}
                                    </div>
                                    <div className="chat-text">
                                        <input type='text' placeholder='Type a message...' value={message} onChange={event => setMessage(event.target.value)} onKeyPress={event => event.key==='Enter' && sendMessage(event)} />
                                    </div>
                                </div>
                            </div>
                        </div> </> }

                        {/* PLAYER 2 VIEW */}
                        {currentUser === 'Player 2' && <>
                        <div className='player1Deck' style={{pointerEvents: 'none'}}>
                            <p className='playerDeckText'>Player 1</p>
                            {player1Deck.map((item, i) => (
                                <img
                                    key={i}
                                    className='Card'
                                    onClick={() => onCardPlayedHandler(item)}
                                    src={require(`../assets/card-back.png`).default}
                                    />
                            ))}
                            {turn==='Player 1' && <Spinner />}
                        </div>
                        <br />
                        <div className='middleInfo' style={turn === 'Player 1' ? {pointerEvents: 'none'} : null}>
                            <button className='game-button red' disabled={turn !== 'Player 2'} onClick={onCardDrawnHandler}>DRAW CARD</button>
                            {playedCardsPile && playedCardsPile.length>0 &&
                            <img
                                className='Card'
                                src={require(`../assets/cards-front/${playedCardsPile[playedCardsPile.length-1]}.png`).default}
                                /> }
                            
                        </div>
                        
                        <br />
                        <div className='player2Deck' style={turn === 'Player 1' ? {pointerEvents: 'none'} : null}>
                            <p className='playerDeckText'>Player 2</p>
                            {player2Deck.map((item, i) => (
                                <img
                                    key={i}
                                    className='Card'
                                    onClick={() => onCardPlayedHandler(item)}
                                    src={require(`../assets/cards-front/${item}.png`).default}
                                    />
                            ))}
                        </div>
                        <div className="chatBoxWrapper">
                            <div className="chat-box chat-box-player2">
                                <div className="chat-head">
                                    <h2>Chat Box</h2>
                                    {!isChatBoxHidden ?
                                    <span onClick={toggleChatBox} class="material-icons">keyboard_arrow_down</span> :
                                    <span onClick={toggleChatBox} class="material-icons">keyboard_arrow_up</span>}
                                </div>
                                <div className="chat-body">
                                    <div className="msg-insert">
                                        {messages.map(msg => {
                                            if(msg.user === 'Player 1')
                                                return <div className="msg-receive">{msg.text}</div>
                                            if(msg.user === 'Player 2')
                                                return <div className="msg-send">{msg.text}</div>
                                        })}
                                    </div>
                                    <div className="chat-text">
                                        <input type='text' placeholder='Type a message...' value={message} onChange={event => setMessage(event.target.value)} onKeyPress={event => event.key==='Enter' && sendMessage(event)} />
                                    </div>
                                </div>
                            </div>
                        </div> </> }
                    </div> }
                </> }
            </> : <h1>Room full</h1> }

            <br />
            <a href='/'><button className="game-button quit">QUIT</button></a>
        </div>
    )
}

export default Game