import { useRef, useState, useEffect, useCallback } from "react";
import { Box, Input, VStack, HStack, Image, Text, Spinner } from "@chakra-ui/react";
import useSpotifyStore from "../../../store/useSpotifyStore";

export default function SearchBar() {
  const { query, setQuery, search, searchResults, isSearching, selectTrack } =
    useSpotifyStore();
  const [showDropdown, setShowDropdown] = useState(false);
  const timerRef = useRef(null);
  const containerRef = useRef(null);

  const debouncedSearch = useCallback(
    (value) => {
      clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => search(value), 350);
    },
    [search]
  );

  useEffect(() => () => clearTimeout(timerRef.current), []);

  useEffect(() => {
    setShowDropdown(searchResults.length > 0);
  }, [searchResults]);

  useEffect(() => {
    const handleClick = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const handleChange = (e) => {
    const value = e.target.value;
    setQuery(value);
    debouncedSearch(value);
  };

  const handleSelect = (track) => {
    setShowDropdown(false);
    selectTrack(track);
  };

  return (
    <Box ref={containerRef} position="relative" w="100%" maxW="600px">
      <Box position="relative">
        <Input
          value={query}
          onChange={handleChange}
          onFocus={() => searchResults.length > 0 && setShowDropdown(true)}
          placeholder="Search for a song..."
          size="lg"
          bg="#1e1e1e"
          border="1px solid"
          borderColor="#3a3a3a"
          color="white"
          _placeholder={{ color: "#888" }}
          _focus={{ borderColor: "#1DB954", boxShadow: "0 0 0 1px #1DB954" }}
          borderRadius="full"
          px="6"
          pr="12"
        />
        {isSearching && (
          <Spinner
            color="#1DB954"
            size="sm"
            position="absolute"
            right="16px"
            top="50%"
            transform="translateY(-50%)"
          />
        )}
      </Box>

      {showDropdown && (
        <VStack
          position="absolute"
          top="100%"
          mt="2"
          w="100%"
          bg="#1e1e1e"
          border="1px solid #3a3a3a"
          borderRadius="lg"
          maxH="400px"
          overflowY="auto"
          zIndex="999"
          spacing="0"
          boxShadow="dark-lg"
        >
          {searchResults.map((track) => (
            <HStack
              key={track.id}
              w="100%"
              p="3"
              cursor="pointer"
              _hover={{ bg: "#2a2a2a" }}
              onClick={() => handleSelect(track)}
              spacing="3"
            >
              <Image
                src={track.album.imageSmall || track.album.image}
                alt={track.album.name}
                boxSize="40px"
                borderRadius="md"
                objectFit="cover"
                flexShrink="0"
                fallbackSrc="https://via.placeholder.com/40/1e1e1e/666?text=+"
              />
              <Box flex="1" minW="0">
                <Text color="white" fontSize="sm" noOfLines={1} fontWeight="500">
                  {track.name}
                </Text>
                <Text color="#aaa" fontSize="xs" noOfLines={1}>
                  {track.artists.map((a) => a.name).join(", ")}
                </Text>
              </Box>
            </HStack>
          ))}
        </VStack>
      )}
    </Box>
  );
}
