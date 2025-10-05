pragma solidity ^0.8.20;

contract SecretRegistry {
    
    event SecretRegistered(
        bytes32 indexed secretId,
        address indexed owner,
        uint8 thresholdM,
        uint256 participantsCount,
        bytes32 secretHash,     
        uint64 timestamp
    );

    event ReceiptConfirmed(
        bytes32 indexed secretId,
        address indexed participant,
        uint64 timestamp
    );

    event SecretClosed(
        bytes32 indexed secretId,
        uint64 timestamp
    );

    error AlreadyExists();
    error NotOwner();
    error NotParticipant();
    error AlreadyConfirmed();
    error InvalidThreshold();
    error NotActive();
    error UnknownSecret();


    struct SecretMeta {
        address owner;
        uint8 thresholdM;           
        bytes32 secretHash;         
        bool active;                
        uint64 createdAt;
        address[] participants;     
        uint32 confirmations;      
    }

    mapping(bytes32 => SecretMeta) private _secrets;

    mapping(bytes32 => mapping(address => bool)) private _confirmed;

    function getSecret(bytes32 secretId)
        external
        view
        returns (
            address owner,
            uint8 thresholdM,
            bytes32 secretHash,
            bool active,
            uint64 createdAt,
            address[] memory participants,
            uint32 confirmations
        )
    {
        SecretMeta storage s = _secrets[secretId];
        if (s.owner == address(0)) revert UnknownSecret();
        return (
            s.owner,
            s.thresholdM,
            s.secretHash,
            s.active,
            s.createdAt,
            s.participants,
            s.confirmations
        );
    }

    function isParticipant(bytes32 secretId, address who) public view returns (bool) {
        SecretMeta storage s = _secrets[secretId];
        if (s.owner == address(0)) return false;
        address[] storage P = s.participants;
        for (uint256 i = 0; i < P.length; i++) {
            if (P[i] == who) return true;
        }
        return false;
    }

    function hasConfirmed(bytes32 secretId, address who) external view returns (bool) {
        return _confirmed[secretId][who];
    }

    function canReconstruct(bytes32 secretId) external view returns (bool) {
        SecretMeta storage s = _secrets[secretId];
        if (s.owner == address(0)) return false;
        return s.confirmations >= s.thresholdM;
    }

    function registerSecret(
        bytes32 secretId,
        uint8 thresholdM,
        address[] calldata participants,
        bytes32 secretHash
    ) external {
        if (_secrets[secretId].owner != address(0)) revert AlreadyExists();
        if (participants.length == 0 || thresholdM == 0 || thresholdM > participants.length) {
            revert InvalidThreshold();
        }

        for (uint256 i = 0; i < participants.length; i++) {
            address a = participants[i];
            require(a != address(0), "zero participant");
            for (uint256 j = i + 1; j < participants.length; j++) {
                require(a != participants[j], "duplicate participant");
            }
        }

        SecretMeta storage s = _secrets[secretId];
        s.owner = msg.sender;
        s.thresholdM = thresholdM;
        s.secretHash = secretHash;
        s.active = true;
        s.createdAt = uint64(block.timestamp);

        for (uint256 i = 0; i < participants.length; i++) {
            s.participants.push(participants[i]);
        }

        emit SecretRegistered(
            secretId,
            msg.sender,
            thresholdM,
            participants.length,
            secretHash,
            uint64(block.timestamp)
        );
    }

    function confirmReceipt(bytes32 secretId) external {
        SecretMeta storage s = _secrets[secretId];
        if (s.owner == address(0)) revert UnknownSecret();
        if (!s.active) revert NotActive();
        if (!isParticipant(secretId, msg.sender)) revert NotParticipant();
        if (_confirmed[secretId][msg.sender]) revert AlreadyConfirmed();

        _confirmed[secretId][msg.sender] = true;
        s.confirmations += 1;

        emit ReceiptConfirmed(secretId, msg.sender, uint64(block.timestamp));
    }

    function closeSecret(bytes32 secretId) external {
        SecretMeta storage s = _secrets[secretId];
        if (s.owner == address(0)) revert UnknownSecret();
        if (msg.sender != s.owner) revert NotOwner();
        if (!s.active) revert NotActive();

        s.active = false;
        emit SecretClosed(secretId, uint64(block.timestamp));
    }
}
